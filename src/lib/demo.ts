import type { Account, PullRequest, PullRequestFilesResponse, PullRequestsResponse } from "@/lib/types"

/** `?demo` swaps gh and the GitHub API for fictional data, for screenshots and trying the UI without real accounts. */
export const isDemo = () => new URLSearchParams(window.location.search).has("demo")

const HOUR = 3_600_000

const DEMO_ACCOUNTS: Account[] = [
  { login: "octocat", host: "github.com", active: true },
  { login: "octocat-work", host: "github.com", active: false },
]

type DemoSeed = Pick<PullRequest, "repo" | "number" | "title" | "headRef" | "additions" | "deletions" | "role" | "ci" | "review"> & {
  author: string
  ageHours: number
  draft?: boolean
  approvals?: number
  baseRef?: string
}

const SEEDS: DemoSeed[] = [
  { repo: "acme/storefront", number: 412, title: "Checkout: keep cart items when the session expires", headRef: "fix/cart-session", additions: 184, deletions: 37, role: "review", ci: "pass", review: "required", author: "mira-dev", ageHours: 5 },
  { repo: "acme/storefront", number: 409, title: "Add Apple Pay to the payment step", headRef: "feat/apple-pay", baseRef: "develop", additions: 1240, deletions: 96, role: "review", ci: "pending", review: "required", author: "joao-s", ageHours: 30 },
  { repo: "acme/storefront", number: 401, title: "Product page: lazy load the reviews section", headRef: "perf/lazy-reviews", additions: 88, deletions: 140, role: "review", ci: "pass", review: "required", author: "lin-chen", ageHours: 76 },
  { repo: "acme/storefront", number: 415, title: "Search: typo tolerance and synonyms", headRef: "feat/fuzzy-search", additions: 532, deletions: 41, role: "mine", ci: "pass", review: "approved", author: "octocat", ageHours: 20, approvals: 2 },
  { repo: "acme/api", number: 88, title: "Rate limit public endpoints per API key", headRef: "feat/rate-limit", additions: 310, deletions: 12, role: "review", ci: "fail", review: "required", author: "sam-ops", ageHours: 54 },
  { repo: "acme/api", number: 91, title: "Orders: idempotent retries on webhook delivery", headRef: "fix/webhook-retries", baseRef: "release/2.4", additions: 146, deletions: 58, role: "mine", ci: "fail", review: "changes", author: "octocat", ageHours: 26 },
  { repo: "acme/api", number: 93, title: "Upgrade to Postgres 18 and drop legacy indexes", headRef: "chore/pg18", additions: 64, deletions: 210, role: "mine", ci: "pending", review: "required", author: "octocat", ageHours: 3 },
  { repo: "acme/design-system", number: 57, title: "Button: loading state and icon-only size", headRef: "feat/button-loading", additions: 221, deletions: 18, role: "review", ci: "pass", review: "required", author: "ana-ui", ageHours: 9 },
  { repo: "acme/design-system", number: 55, title: "Dark mode tokens for charts", headRef: "feat/chart-tokens", additions: 98, deletions: 22, role: "mine", ci: "pass", review: "none", author: "octocat", ageHours: 60, draft: true },
  { repo: "acme/mobile", number: 230, title: "Offline queue for push notification receipts", headRef: "feat/offline-receipts", additions: 702, deletions: 133, role: "review", ci: "pass", review: "approved", author: "kofi-a", ageHours: 120, approvals: 1 },
  { repo: "octocat/dotfiles", number: 12, title: "fish: lazy load fnm and add git aliases", headRef: "fish-fnm", additions: 42, deletions: 9, role: "mine", ci: "none", review: "none", author: "octocat", ageHours: 200 },
]

function toPullRequest(seed: DemoSeed, index: number, now: number): PullRequest {
  const createdAt = new Date(now - seed.ageHours * HOUR).toISOString()
  return {
    id: `demo-${index}`,
    number: seed.number,
    title: seed.title,
    url: `https://github.com/${seed.repo}/pull/${seed.number}`,
    repo: seed.repo,
    isDraft: Boolean(seed.draft),
    createdAt,
    updatedAt: createdAt,
    headRef: seed.headRef,
    headSha: `demo-sha-${index}`,
    baseRef: seed.baseRef ?? "main",
    additions: seed.additions,
    deletions: seed.deletions,
    comments: (index * 3) % 7,
    author: { login: seed.author, avatarUrl: "" },
    role: seed.role,
    ci: seed.ci,
    review: seed.review,
    approvals: seed.approvals ?? 0,
    viewerApproved: false,
  }
}

export const demoAccounts = async () => DEMO_ACCOUNTS

export async function demoPullRequests(): Promise<PullRequestsResponse> {
  const now = Date.now()
  return {
    viewer: { login: "octocat", avatarUrl: "" },
    pullRequests: SEEDS.map((seed, index) => toPullRequest(seed, index, now)),
    fetchedAt: new Date(now).toISOString(),
  }
}

const CART_PATCH = `@@ -1,12 +1,25 @@
 import { useEffect, useState } from "react"
-import { getCart } from "@/lib/cart"
+import { getCart, restoreCart } from "@/lib/cart"
+import { onSessionExpired } from "@/lib/session"

 export function useCart(userId: string) {
   const [items, setItems] = useState<CartItem[]>([])

   useEffect(() => {
     getCart(userId).then(setItems)
+
+    // Keep what the shopper picked when they sign back in.
+    return onSessionExpired(async () => {
+      const saved = await restoreCart(userId)
+      setItems((current) => mergeItems(current, saved))
+    })
   }, [userId])

   return items
 }
+
+function mergeItems(current: CartItem[], saved: CartItem[]) {
+  const byId = new Map(current.map((item) => [item.id, item]))
+  for (const item of saved) byId.set(item.id, item)
+  return [...byId.values()]
+}`

const SESSION_PATCH = `@@ -4,6 +4,14 @@ const listeners = new Set<() => void>()
 export function expireSession() {
   clearToken()
-  window.location.assign("/login")
+  listeners.forEach((listener) => listener())
+}
+
+export function onSessionExpired(listener: () => void) {
+  listeners.add(listener)
+  return () => {
+    listeners.delete(listener)
+  }
 }`

const TEST_PATCH = `@@ -0,0 +1,12 @@
+import { describe, expect, it } from "vitest"
+
+import { mergeCartItems } from "@/lib/cart"
+
+describe("mergeCartItems", () => {
+  it("keeps saved items when the session expires", () => {
+    const merged = mergeCartItems([{ id: "a", qty: 1 }], [{ id: "b", qty: 2 }])
+
+    expect(merged).toEqual([{ id: "a", qty: 1 }, { id: "b", qty: 2 }])
+  })
+})`

export async function demoPullRequestFiles(): Promise<PullRequestFilesResponse> {
  return {
    truncated: false,
    files: [
      { filename: "src/features/cart/use-cart.ts", previousFilename: null, status: "modified", additions: 14, deletions: 1, patch: CART_PATCH },
      { filename: "src/lib/session.ts", previousFilename: null, status: "modified", additions: 8, deletions: 1, patch: SESSION_PATCH },
      { filename: "src/lib/cart.test.ts", previousFilename: null, status: "added", additions: 12, deletions: 0, patch: TEST_PATCH },
    ],
  }
}
