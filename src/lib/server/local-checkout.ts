import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readdir, readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import { ghEnv, getToken, runGh } from "@/lib/server/gh"

const execFileAsync = promisify(execFile)

const SKIPPED_DIRS = new Set(["node_modules", ".git", ".worktrees", ".claude", ".next", "dist", "build", "vendor"])
const SCAN_DEPTH = 3
const CLONE_INDEX_TTL_MS = 60_000

export const WORKTREES_ROOT = path.join(homedir(), ".pr-radar", "worktrees")

let cloneIndex: { builtAt: number; byRepo: Map<string, string> } | null = null

export class CloneNotFoundError extends Error {}

function expandHome(dir: string) {
  return dir.startsWith("~") ? path.join(homedir(), dir.slice(1)) : dir
}

export function searchRoots() {
  const configured = process.env.PR_RADAR_ROOTS ?? "~/Apps"
  return configured.split(":").filter(Boolean).map(expandHome)
}

function repoFromRemoteUrl(url: string) {
  const match = url.match(/[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/)
  return match?.[1].toLowerCase()
}

async function remotesOf(gitDir: string) {
  const config = await readFile(path.join(gitDir, "config"), "utf8").catch(() => "")
  return [...config.matchAll(/^\s*url\s*=\s*(.+)$/gm)].map((match) => repoFromRemoteUrl(match[1].trim())).filter(Boolean)
}

async function scan(dir: string, depth: number, byRepo: Map<string, string>) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const hasGitDir = entries.some((entry) => entry.name === ".git" && entry.isDirectory())

  if (hasGitDir) {
    for (const repo of await remotesOf(path.join(dir, ".git"))) {
      if (repo && !byRepo.has(repo)) byRepo.set(repo, dir)
    }
    return
  }

  if (depth === 0) return
  const children = entries.filter((entry) => entry.isDirectory() && !SKIPPED_DIRS.has(entry.name))
  await Promise.all(children.map((child) => scan(path.join(dir, child.name), depth - 1, byRepo)))
}

async function findClone(repo: string) {
  const isFresh = cloneIndex && Date.now() - cloneIndex.builtAt < CLONE_INDEX_TTL_MS
  if (!isFresh) {
    const byRepo = new Map<string, string>()
    await Promise.all(searchRoots().map((root) => scan(root, SCAN_DEPTH, byRepo)))
    cloneIndex = { builtAt: Date.now(), byRepo }
  }
  return cloneIndex!.byRepo.get(repo.toLowerCase())
}

async function git(args: string[], cwd: string, token: string) {
  await execFileAsync("git", args, { cwd, env: ghEnv(token) })
}

async function checkoutPullRequest(worktree: string, number: number, token: string) {
  try {
    await runGh(["pr", "checkout", String(number), "--force"], { token, cwd: worktree })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const branchBusyElsewhere = /already (checked out|used by worktree)/i.test(message)
    if (!branchBusyElsewhere) throw error
    await runGh(["pr", "checkout", String(number), "--detach"], { token, cwd: worktree })
  }
}

export async function openPullRequestInEditor(login: string, host: string, repo: string, number: number) {
  const clone = await findClone(repo)
  if (!clone) {
    throw new CloneNotFoundError(
      `Não achei um clone de ${repo} em ${searchRoots().join(", ")}. Clone o repo lá ou ajuste PR_RADAR_ROOTS.`,
    )
  }

  const token = await getToken(login, host)
  const [owner, name] = repo.split("/")
  const worktree = path.join(WORKTREES_ROOT, owner, name, `pr-${number}`)

  if (!existsSync(worktree)) {
    await mkdir(path.dirname(worktree), { recursive: true })
    await git(["worktree", "add", "--detach", worktree], clone, token)
  }

  await checkoutPullRequest(worktree, number, token)
  await execFileAsync("code", [worktree])

  return { worktree, clone }
}
