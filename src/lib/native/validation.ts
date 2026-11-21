import type { Account } from "@/lib/types"

const LOGIN_PATTERN = /^[A-Za-z0-9-]+$/
const HOST_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]*$/
const REPO_PATTERN = /^[A-Za-z0-9-]+\/(?!\.{1,2}$)[\w.-]+$/

/** Values end up as gh/git arguments and file paths, so anything that could read as a flag or escape a directory is refused. */
export function assertAccount(account: Account) {
  if (!LOGIN_PATTERN.test(account.login)) throw new Error(`Invalid account: ${account.login}`)
  if (!HOST_PATTERN.test(account.host)) throw new Error(`Invalid host: ${account.host}`)
}

export function assertRepo(repo: string) {
  if (!REPO_PATTERN.test(repo)) throw new Error(`Invalid repository: ${repo}`)
}

export function assertPullRequestNumber(number: number) {
  if (!Number.isInteger(number) || number <= 0) throw new Error(`Invalid pull request number: ${number}`)
}
