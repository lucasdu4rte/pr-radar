import { demoPullRequestFiles, demoPullRequests, isDemo } from "@/lib/demo"
import { graphql, rest, restPost } from "@/lib/github/client"
import { assertPullRequestNumber, assertRepo } from "@/lib/native/validation"
import type {
  Account,
  CiState,
  PullRequest,
  PullRequestFile,
  PullRequestFilesResponse,
  PullRequestFileStatus,
  PullRequestRole,
  PullRequestsResponse,
  ReviewState,
} from "@/lib/types"

const PULL_REQUESTS_QUERY = /* GraphQL */ `
  query PullRequests($mine: String!, $review: String!) {
    viewer { login avatarUrl }
    mine: search(query: $mine, type: ISSUE, first: 100) { nodes { ...PullRequestFields } }
    review: search(query: $review, type: ISSUE, first: 100) { nodes { ...PullRequestFields } }
  }

  fragment PullRequestFields on PullRequest {
    id
    number
    title
    url
    isDraft
    createdAt
    updatedAt
    headRefName
    headRefOid
    baseRefName
    additions
    deletions
    reviewDecision
    author { login avatarUrl }
    repository { nameWithOwner }
    comments { totalCount }
    viewerLatestReview { state }
    latestOpinionatedReviews(first: 30) { nodes { state } }
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  }
`

const APPROVE_MUTATION = /* GraphQL */ `
  mutation Approve($pullRequestId: ID!, $body: String) {
    addPullRequestReview(input: { pullRequestId: $pullRequestId, event: APPROVE, body: $body }) {
      pullRequestReview { state }
    }
  }
`

type RawPullRequest = {
  id: string
  number: number
  title: string
  url: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  headRefName: string
  headRefOid: string
  baseRefName: string
  additions: number
  deletions: number
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null
  author: { login: string; avatarUrl: string } | null
  repository: { nameWithOwner: string }
  comments: { totalCount: number }
  viewerLatestReview: { state: string } | null
  latestOpinionatedReviews: { nodes: { state: string }[] }
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] }
}

type RawResponse = {
  viewer: { login: string; avatarUrl: string }
  mine: { nodes: (RawPullRequest | Record<string, never>)[] }
  review: { nodes: (RawPullRequest | Record<string, never>)[] }
}

const CI_BY_ROLLUP: Record<string, CiState> = {
  SUCCESS: "pass",
  FAILURE: "fail",
  ERROR: "fail",
  PENDING: "pending",
  EXPECTED: "pending",
}

const REVIEW_BY_DECISION: Record<string, ReviewState> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes",
  REVIEW_REQUIRED: "required",
}

function toPullRequest(raw: RawPullRequest, role: PullRequestRole): PullRequest {
  const rollup = raw.commits.nodes[0]?.commit.statusCheckRollup?.state
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    repo: raw.repository.nameWithOwner,
    isDraft: raw.isDraft,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    headRef: raw.headRefName,
    headSha: raw.headRefOid,
    baseRef: raw.baseRefName,
    additions: raw.additions,
    deletions: raw.deletions,
    comments: raw.comments.totalCount,
    author: raw.author ?? { login: "ghost", avatarUrl: "" },
    role,
    ci: rollup ? (CI_BY_ROLLUP[rollup] ?? "none") : "none",
    review: raw.reviewDecision ? REVIEW_BY_DECISION[raw.reviewDecision] : "none",
    approvals: raw.latestOpinionatedReviews.nodes.filter((review) => review.state === "APPROVED").length,
    viewerApproved: raw.viewerLatestReview?.state === "APPROVED",
  }
}

const isPullRequest = (node: RawPullRequest | Record<string, never>): node is RawPullRequest => "id" in node

export async function fetchPullRequests(account: Account): Promise<PullRequestsResponse> {
  if (isDemo()) return demoPullRequests()
  const data = await graphql<RawResponse>(account, PULL_REQUESTS_QUERY, {
    mine: "is:pr is:open archived:false author:@me",
    review: "is:pr is:open archived:false review-requested:@me",
  })

  const byId = new Map<string, PullRequest>()
  data.mine.nodes.filter(isPullRequest).forEach((node) => byId.set(node.id, toPullRequest(node, "mine")))
  data.review.nodes
    .filter(isPullRequest)
    .filter((node) => !byId.has(node.id))
    .forEach((node) => byId.set(node.id, toPullRequest(node, "review")))

  return { viewer: data.viewer, pullRequests: [...byId.values()], fetchedAt: new Date().toISOString() }
}

const FILES_PER_PAGE = 100
const MAX_FILE_PAGES = 5

type RawPullRequestFile = {
  filename: string
  previous_filename?: string
  status: PullRequestFileStatus
  additions: number
  deletions: number
  patch?: string
}

export async function fetchPullRequestFiles(account: Account, repo: string, number: number): Promise<PullRequestFilesResponse> {
  if (isDemo()) return demoPullRequestFiles()
  assertRepo(repo)
  assertPullRequestNumber(number)
  const files: PullRequestFile[] = []

  for (let page = 1; page <= MAX_FILE_PAGES; page++) {
    const batch = await rest<RawPullRequestFile[]>(account, `/repos/${repo}/pulls/${number}/files?per_page=${FILES_PER_PAGE}&page=${page}`)
    files.push(
      ...batch.map((file) => ({
        filename: file.filename,
        previousFilename: file.previous_filename ?? null,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch ?? null,
      })),
    )
    if (batch.length < FILES_PER_PAGE) return { files, truncated: false }
  }

  return { files, truncated: true }
}

export async function approvePullRequest(account: Account, pullRequestId: string, body: string) {
  if (isDemo()) throw new Error("Not available in demo mode")
  await graphql(account, APPROVE_MUTATION, { pullRequestId, body: body.trim() || null })
}

const RERUNNABLE_CONCLUSIONS = new Set(["failure", "timed_out", "cancelled"])

type RawWorkflowRun = { id: number; workflow_id: number; event: string; status: string; conclusion: string | null }

/** Runs come newest first; an older failed run is superseded once the same workflow ran again for the same trigger. */
function latestRunPerWorkflow(runs: RawWorkflowRun[]) {
  const byWorkflow = new Map<string, RawWorkflowRun>()
  for (const run of runs) {
    const key = `${run.workflow_id}:${run.event}`
    if (!byWorkflow.has(key)) byWorkflow.set(key, run)
  }
  return [...byWorkflow.values()]
}

/** Re-runs the failed jobs of every GitHub Actions run on the PR's head commit and returns how many runs were restarted. */
export async function rerunFailedJobs(account: Account, pullRequest: Pick<PullRequest, "repo" | "headSha">) {
  if (isDemo()) throw new Error("Not available in demo mode")
  assertRepo(pullRequest.repo)
  const { workflow_runs: runs } = await rest<{ workflow_runs: RawWorkflowRun[] }>(
    account,
    `/repos/${pullRequest.repo}/actions/runs?head_sha=${encodeURIComponent(pullRequest.headSha)}&per_page=100`,
  )
  const failedRuns = latestRunPerWorkflow(runs).filter((run) => run.status === "completed" && RERUNNABLE_CONCLUSIONS.has(run.conclusion ?? ""))
  if (failedRuns.length === 0) throw new Error("No failed GitHub Actions runs on the latest commit")

  const results = await Promise.allSettled(
    failedRuns.map((run) => restPost(account, `/repos/${pullRequest.repo}/actions/runs/${run.id}/rerun-failed-jobs`)),
  )
  const restarted = results.filter((result) => result.status === "fulfilled").length
  const firstFailure = results.find((result) => result.status === "rejected")
  if (restarted === 0 && firstFailure) throw firstFailure.reason
  return restarted
}
