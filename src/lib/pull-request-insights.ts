import type { PullRequest, PullRequestRole } from "@/lib/types"

const HOUR_MS = 3_600_000
const STALE_REVIEW_HOURS = 48

export type RoleFilter = PullRequestRole | "all"

export type RepoGroup = { repo: string; pullRequests: PullRequest[] }

export function hoursSince(isoDate: string, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(isoDate).getTime()) / HOUR_MS))
}

export function ageLabel(isoDate: string, now = Date.now()) {
  const hours = hoursSince(isoDate, now)
  if (hours < 1) return "now"
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

export function isStaleReview(pullRequest: PullRequest, now = Date.now()) {
  return pullRequest.role === "review" && hoursSince(pullRequest.createdAt, now) >= STALE_REVIEW_HOURS
}

export function isBlocked(pullRequest: PullRequest) {
  return pullRequest.ci === "fail" || pullRequest.review === "changes"
}

export function isReadyToMerge(pullRequest: PullRequest) {
  const ciAllowsMerge = pullRequest.ci === "pass" || pullRequest.ci === "none"
  const reviewAllowsMerge = pullRequest.review === "approved" || pullRequest.review === "none"
  return !pullRequest.isDraft && ciAllowsMerge && reviewAllowsMerge
}

export function matchesQuery(pullRequest: PullRequest, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = [pullRequest.title, pullRequest.repo, pullRequest.author.login, `#${pullRequest.number}`, pullRequest.headRef]
  return haystack.join(" ").toLowerCase().includes(needle)
}

export function byRole(pullRequests: PullRequest[], role: RoleFilter) {
  return role === "all" ? pullRequests : pullRequests.filter((pullRequest) => pullRequest.role === role)
}

export function groupByRepo(pullRequests: PullRequest[]): RepoGroup[] {
  const groups = new Map<string, PullRequest[]>()
  for (const pullRequest of pullRequests) {
    groups.set(pullRequest.repo, [...(groups.get(pullRequest.repo) ?? []), pullRequest])
  }

  const newestFirst = (a: PullRequest, b: PullRequest) => b.createdAt.localeCompare(a.createdAt)
  return [...groups.entries()]
    .map(([repo, items]) => ({ repo, pullRequests: items.sort(newestFirst) }))
    .sort((a, b) => b.pullRequests.length - a.pullRequests.length || a.repo.localeCompare(b.repo))
}

export type FocusBucketKey = "review" | "blocked" | "ready" | "waiting"

export function focusBuckets(pullRequests: PullRequest[]): Record<FocusBucketKey, PullRequest[]> {
  const mine = pullRequests.filter((pullRequest) => pullRequest.role === "mine")
  const oldestFirst = (a: PullRequest, b: PullRequest) => a.createdAt.localeCompare(b.createdAt)

  return {
    review: pullRequests
      .filter((pullRequest) => pullRequest.role === "review" && !pullRequest.isDraft)
      .sort(oldestFirst),
    blocked: mine.filter(isBlocked),
    ready: mine.filter((pullRequest) => !isBlocked(pullRequest) && isReadyToMerge(pullRequest)),
    waiting: mine.filter((pullRequest) => !isBlocked(pullRequest) && !isReadyToMerge(pullRequest)),
  }
}

export function splitRepo(repo: string) {
  const [owner, name] = repo.split("/")
  return { owner, name }
}
