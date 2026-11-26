export type Account = {
  login: string
  host: string
  active: boolean
}

export type CiState = "pass" | "fail" | "pending" | "none"

export type ReviewState = "approved" | "changes" | "required" | "none"

export type PullRequestRole = "mine" | "review"

export type PullRequest = {
  id: string
  number: number
  title: string
  url: string
  repo: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  headRef: string
  headSha: string
  baseRef: string
  additions: number
  deletions: number
  comments: number
  author: { login: string; avatarUrl: string }
  role: PullRequestRole
  ci: CiState
  review: ReviewState
  approvals: number
  viewerApproved: boolean
}

export type PullRequestFileStatus = "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged"

export type PullRequestFile = {
  filename: string
  previousFilename: string | null
  status: PullRequestFileStatus
  additions: number
  deletions: number
  patch: string | null
}

export type PullRequestFilesResponse = {
  files: PullRequestFile[]
  truncated: boolean
}

export type PullRequestsResponse = {
  viewer: { login: string; avatarUrl: string }
  pullRequests: PullRequest[]
  fetchedAt: string
}
