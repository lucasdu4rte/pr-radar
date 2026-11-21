import { graphql, rest } from "@/lib/github/client"
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
  await graphql(account, APPROVE_MUTATION, { pullRequestId, body: body.trim() || null })
}
