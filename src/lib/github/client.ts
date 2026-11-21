import { demoAccounts, isDemo } from "@/lib/demo"
import { run } from "@/lib/native/command"
import { assertAccount } from "@/lib/native/validation"
import type { Account } from "@/lib/types"

const tokenCache = new Map<string, string>()

type AuthStatusEntry = { login: string; host: string; active: boolean; state: string }

export async function listAccounts(): Promise<Account[]> {
  if (isDemo()) return demoAccounts()
  const stdout = await run("gh", ["auth", "status", "--json", "hosts"])
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

export async function getToken(account: Account) {
  assertAccount(account)
  const key = `${account.host}/${account.login}`
  const cached = tokenCache.get(key)
  if (cached) return cached

  const token = (await run("gh", ["auth", "token", "--user", account.login, "--hostname", account.host])).trim()
  if (!token) throw new Error(`gh returned no token for ${account.login}@${account.host}`)
  tokenCache.set(key, token)
  return token
}

function restBaseUrl(host: string) {
  return host === "github.com" ? "https://api.github.com" : `https://${host}/api/v3`
}

function graphqlEndpoint(host: string) {
  return host === "github.com" ? "https://api.github.com/graphql" : `https://${host}/api/graphql`
}

export async function rest<T>(account: Account, path: string) {
  const token = await getToken(account)
  const response = await fetch(`${restBaseUrl(account.host)}${path}`, {
    headers: { Authorization: `bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`GitHub responded ${response.status}: ${await response.text()}`)
  return (await response.json()) as T
}

export async function graphql<T>(account: Account, query: string, variables: Record<string, unknown>) {
  const token = await getToken(account)
  const response = await fetch(graphqlEndpoint(account.host), {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  })

  if (!response.ok) throw new Error(`GitHub responded ${response.status}: ${await response.text()}`)

  const payload = (await response.json()) as { data?: T; errors?: { message: string }[] }
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join("; "))
  if (!payload.data) throw new Error("GitHub response had no data")
  return payload.data
}
