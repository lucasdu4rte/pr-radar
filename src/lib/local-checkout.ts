import { homeDir, join } from "@tauri-apps/api/path"
import { exists, readDir, readTextFile } from "@tauri-apps/plugin-fs"
import { openPath } from "@tauri-apps/plugin-opener"

import { getToken } from "@/lib/github/client"
import { run } from "@/lib/native/command"
import { assertAccount, assertPullRequestNumber, assertRepo } from "@/lib/native/validation"
import type { Account } from "@/lib/types"

const SKIPPED_DIRS = new Set(["node_modules", ".git", ".worktrees", ".claude", ".next", "dist", "build", "vendor", "target"])
const SCAN_DEPTH = 3
const CLONE_INDEX_TTL_MS = 60_000
const ROOTS_STORAGE_KEY = "pr-radar:clone-roots"
const DEFAULT_ROOTS = "~/Apps"
const EDITOR_APP = "Visual Studio Code"

let cloneIndex: { builtAt: number; roots: string; byRepo: Map<string, string> } | null = null

export class CloneNotFoundError extends Error {}

export function readSearchRoots() {
  try {
    return localStorage.getItem(ROOTS_STORAGE_KEY) || DEFAULT_ROOTS
  } catch {
    return DEFAULT_ROOTS
  }
}

export function storeSearchRoots(roots: string) {
  try {
    localStorage.setItem(ROOTS_STORAGE_KEY, roots.trim() || DEFAULT_ROOTS)
  } catch {}
  cloneIndex = null
}

async function expandHome(dir: string) {
  if (!dir.startsWith("~")) return dir
  return join(await homeDir(), dir.slice(1).replace(/^\//, ""))
}

async function resolvedRoots(roots: string) {
  const dirs = roots.split(/[:,\n]/).map((dir) => dir.trim()).filter(Boolean)
  return Promise.all(dirs.map(expandHome))
}

function repoFromRemoteUrl(url: string) {
  const match = url.match(/[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/)
  return match?.[1].toLowerCase()
}

async function remotesOf(gitDir: string) {
  const config = await readTextFile(await join(gitDir, "config")).catch(() => "")
  return [...config.matchAll(/^\s*url\s*=\s*(.+)$/gm)].map((match) => repoFromRemoteUrl(match[1].trim())).filter(Boolean)
}

async function scan(dir: string, depth: number, byRepo: Map<string, string>) {
  const entries = await readDir(dir).catch(() => [])
  const hasGitDir = entries.some((entry) => entry.name === ".git" && entry.isDirectory)

  if (hasGitDir) {
    for (const repo of await remotesOf(await join(dir, ".git"))) {
      if (repo && !byRepo.has(repo)) byRepo.set(repo, dir)
    }
    return
  }

  if (depth === 0) return
  const children = entries.filter((entry) => entry.isDirectory && !SKIPPED_DIRS.has(entry.name))
  await Promise.all(children.map(async (child) => scan(await join(dir, child.name), depth - 1, byRepo)))
}

async function findClone(repo: string) {
  const roots = readSearchRoots()
  const isFresh = cloneIndex && cloneIndex.roots === roots && Date.now() - cloneIndex.builtAt < CLONE_INDEX_TTL_MS
  if (!isFresh) {
    const byRepo = new Map<string, string>()
    await Promise.all((await resolvedRoots(roots)).map((root) => scan(root, SCAN_DEPTH, byRepo)))
    cloneIndex = { builtAt: Date.now(), roots, byRepo }
  }
  return cloneIndex!.byRepo.get(repo.toLowerCase())
}

async function checkoutPullRequest(worktree: string, number: number, token: string) {
  try {
    await run("gh", ["pr", "checkout", String(number), "--force"], { token, cwd: worktree })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const branchBusyElsewhere = /already (checked out|used by worktree)/i.test(message)
    if (!branchBusyElsewhere) throw error
    await run("gh", ["pr", "checkout", String(number), "--detach"], { token, cwd: worktree })
  }
}

export async function openPullRequestInEditor(account: Account, repo: string, number: number) {
  assertAccount(account)
  assertRepo(repo)
  assertPullRequestNumber(number)

  const clone = await findClone(repo)
  if (!clone) {
    throw new CloneNotFoundError(`Não achei um clone de ${repo} em ${readSearchRoots()}.`)
  }

  const token = await getToken(account)
  const [owner, name] = repo.split("/")
  const worktree = await join(await homeDir(), ".pr-radar", "worktrees", owner, name, `pr-${number}`)

  if (!(await exists(worktree))) {
    await run("git", ["worktree", "add", "--detach", worktree], { cwd: clone })
  }

  await checkoutPullRequest(worktree, number, token)
  await openPath(worktree, EDITOR_APP)

  return { worktree, clone }
}
