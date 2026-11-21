import { execFile } from "node:child_process"
import { promisify } from "node:util"

import type { Account } from "@/lib/types"

const execFileAsync = promisify(execFile)

const tokenCache = new Map<string, string>()

/**
 * GH_TOKEN/GITHUB_TOKEN in the server's environment would override every
 * account, so they are stripped and the per-account token is injected instead.
 */
export function ghEnv(token?: string): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.GH_TOKEN
  delete env.GITHUB_TOKEN
  delete env.GH_ENTERPRISE_TOKEN
  if (token) env.GH_TOKEN = token
  return env
}

export async function runGh(args: string[], options: { token?: string; cwd?: string } = {}) {
  const { stdout } = await execFileAsync("gh", args, {
    env: ghEnv(options.token),
    cwd: options.cwd,
    maxBuffer: 10 * 1024 * 1024,
  })
  return stdout
}

type AuthStatusEntry = { login: string; host: string; active: boolean; state: string }

export async function listAccounts(): Promise<Account[]> {
  const stdout = await runGh(["auth", "status", "--json", "hosts"])
  const parsed = JSON.parse(stdout) as { hosts: Record<string, AuthStatusEntry[]> }
  const byKey = new Map<string, Account>()

  for (const entry of Object.values(parsed.hosts).flat()) {
    if (entry.state !== "success") continue
    const key = `${entry.host}/${entry.login}`
    const existing = byKey.get(key)
    byKey.set(key, { login: entry.login, host: entry.host, active: entry.active || Boolean(existing?.active) })
  }

  return [...byKey.values()].sort((a, b) => Number(b.active) - Number(a.active))
}

export async function getToken(login: string, host: string) {
  const key = `${host}/${login}`
  const cached = tokenCache.get(key)
  if (cached) return cached

  const token = (await runGh(["auth", "token", "--user", login, "--hostname", host])).trim()
  if (!token) throw new Error(`gh não retornou token para ${login}@${host}`)
  tokenCache.set(key, token)
  return token
}

function restBaseUrl(host: string) {
  return host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`
}

export async function rest<T>(host: string, token: string, path: string) {
  const response = await fetch(`${restBaseUrl(host)}${path}`, {
    headers: { Authorization: `bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`GitHub respondeu ${response.status}: ${await response.text()}`)
  return (await response.json()) as T
}

function graphqlEndpoint(host: string) {
  return host === "github.com" ? "https://api.github.com/graphql" : `https://${host}/api/graphql`
}

export async function graphql<T>(host: string, token: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch(graphqlEndpoint(host), {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  })

  if (!response.ok) throw new Error(`GitHub respondeu ${response.status}: ${await response.text()}`)

  const payload = (await response.json()) as { data?: T; errors?: { message: string }[] }
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join("; "))
  if (!payload.data) throw new Error("Resposta do GitHub sem dados")
  return payload.data
}
