"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { GitPullRequestIcon, InboxIcon, RefreshCwIcon, SearchIcon, TargetIcon } from "lucide-react"

import { AccountPicker, accountKey } from "@/components/radar/account-picker"
import { FocusView } from "@/components/radar/focus-view"
import { InboxView } from "@/components/radar/inbox-view"
import { PullRequestSheet } from "@/components/radar/pull-request-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ageLabel, byRole, matchesQuery, type RoleFilter } from "@/lib/pull-request-insights"
import type { Account, PullRequest, PullRequestsResponse } from "@/lib/types"
import { cn } from "@/lib/utils"

import { pullRequestParam, useRadarFilters, type View } from "@/components/radar/use-radar-filters"

const SELECTED_ACCOUNT_STORAGE_KEY = "pr-radar:account"
const AUTO_REFRESH_MS = 5 * 60_000

function readStoredAccount() {
  try {
    return localStorage.getItem(SELECTED_ACCOUNT_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeAccount(account: Account) {
  try {
    localStorage.setItem(SELECTED_ACCOUNT_STORAGE_KEY, accountKey(account))
  } catch {}
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Falha (${response.status})`)
  return payload as T
}

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

function useAccounts(urlAccount: string | null, urlHost: string | null) {
  const query = useQuery({
    queryKey: ["accounts"],
    queryFn: () => getJson<{ accounts: Account[] }>("/api/accounts").then((payload) => payload.accounts),
    staleTime: Infinity,
  })
  const [storedKey] = useState(readStoredAccount)
  const accounts = query.data ?? null
  const fromUrl = accounts?.find((account) => account.login === urlAccount && account.host === (urlHost ?? "github.com"))
  const fromStorage = accounts?.find((account) => accountKey(account) === storedKey)
  const selected = fromUrl ?? fromStorage ?? accounts?.[0] ?? null

  return { accounts, selected, error: query.error?.message ?? null }
}

const pullRequestsKey = (account: Account | null) => ["pull-requests", account ? accountKey(account) : null]

function usePullRequests(account: Account | null) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: pullRequestsKey(account),
    enabled: account !== null,
    refetchInterval: AUTO_REFRESH_MS,
    queryFn: () => {
      const params = new URLSearchParams({ login: account!.login, host: account!.host })
      return getJson<PullRequestsResponse>(`/api/pull-requests?${params}`)
    },
  })

  const markApproved = (pullRequestId: string) =>
    queryClient.setQueryData<PullRequestsResponse>(pullRequestsKey(account), (current) =>
      current && {
        ...current,
        pullRequests: current.pullRequests.map((pullRequest) =>
          pullRequest.id === pullRequestId
            ? { ...pullRequest, viewerApproved: true, approvals: pullRequest.approvals + 1 }
            : pullRequest,
        ),
      },
    )

  return {
    data: query.data ?? null,
    loading: query.isFetching,
    error: query.error?.message ?? null,
    reload: () => query.refetch(),
    markApproved,
  }
}

function LoadingRows() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <p className="font-medium">Não consegui carregar os PRs</p>
      <p className="text-sm break-words text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}

export function RadarApp() {
  const now = useNow()
  const [filters, setFilters] = useRadarFilters()
  const { view, role: roleFilter, query, hideDrafts, project } = filters
  const { accounts, selected, error: accountsError } = useAccounts(filters.account, filters.host)
  const { data, loading, error, reload, markApproved } = usePullRequests(selected)

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea")
      if (event.key !== "/" || typing) return
      event.preventDefault()
      document.getElementById("pr-search")?.focus()
    }
    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [])

  const visible = useMemo(
    () =>
      (data?.pullRequests ?? []).filter(
        (pullRequest) => (!hideDrafts || !pullRequest.isDraft) && matchesQuery(pullRequest, query),
      ),
    [data, hideDrafts, query],
  )
  const counts = { review: byRole(visible, "review").length, mine: byRole(visible, "mine").length, all: visible.length }
  const inboxPullRequests = byRole(visible, roleFilter)
  const activeProject = project && inboxPullRequests.some((pullRequest) => pullRequest.repo === project) ? project : null
  const openPullRequest =
    data?.pullRequests.find((pullRequest) => pullRequestParam(pullRequest.repo, pullRequest.number) === filters.pullRequest) ?? null

  const [sheetPullRequest, setSheetPullRequest] = useState<PullRequest | null>(null)
  if (openPullRequest && openPullRequest !== sheetPullRequest) setSheetPullRequest(openPullRequest)

  const openSheet = (pullRequest: PullRequest) => setFilters({ pullRequest: pullRequestParam(pullRequest.repo, pullRequest.number) })

  const changeAccount = (account: Account) => {
    storeAccount(account)
    setFilters({ account: account.login, host: account.host, project: null, pullRequest: null })
  }

  if (accountsError) return <ErrorState message={`gh auth status falhou: ${accountsError}`} />

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-2.5 backdrop-blur">
        <span className="mr-1 flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GitPullRequestIcon className="size-4" />
          </span>
          Radar
        </span>

        {accounts && selected ? <AccountPicker accounts={accounts} selected={selected} onSelect={changeAccount} /> : <Skeleton className="h-8 w-36" />}

        <Tabs value={view} onValueChange={(value) => setFilters({ view: value as View })}>
          <TabsList>
            <TabsTrigger value="inbox" className="px-2.5">
              <InboxIcon />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="focus" className="px-2.5">
              <TargetIcon />
              Foco
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {view === "inbox" && (
          <Tabs value={roleFilter} onValueChange={(value) => setFilters({ role: value as RoleFilter })}>
            <TabsList>
              {(
                [
                  ["review", "Para revisar"],
                  ["mine", "Meus"],
                  ["all", "Todos"],
                ] as const
              ).map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="px-2.5">
                  {label}
                  <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">{counts[value]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <label className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="pr-search"
            value={query}
            onChange={(event) => setFilters({ query: event.target.value })}
            placeholder="Buscar título, repo, autor ou #número"
            className="pr-8 pl-8"
            aria-label="Buscar PRs"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border px-1.5 font-mono text-[11px] text-muted-foreground">/</kbd>
        </label>

        <label className="flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
          <Switch checked={hideDrafts} onCheckedChange={(checked) => setFilters({ hideDrafts: checked })} />
          Ocultar drafts
        </label>

        <Button variant="ghost" size="sm" onClick={reload} disabled={loading} className="text-muted-foreground">
          <RefreshCwIcon className={cn(loading && "animate-spin")} />
          <span className="hidden lg:inline">{data && !loading ? `atualizado ${ageLabel(data.fetchedAt, now) === "agora" ? "agora" : `há ${ageLabel(data.fetchedAt, now)}`}` : "atualizando…"}</span>
        </Button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {error && !data && <ErrorState message={error} onRetry={reload} />}
        {!error && !data && <LoadingRows />}
        {data && view === "inbox" && (
          <InboxView pullRequests={inboxPullRequests} project={activeProject} onProjectChange={(repo) => setFilters({ project: repo })} onOpen={openSheet} now={now} />
        )}
        {data && view === "focus" && <FocusView pullRequests={visible} onOpen={openSheet} now={now} />}
      </main>

      {selected && (
        <PullRequestSheet
          open={openPullRequest !== null}
          pullRequest={sheetPullRequest}
          account={selected}
          now={now}
          onClose={() => setFilters({ pullRequest: null })}
          onApproved={markApproved}
        />
      )}
    </div>
  )
}
