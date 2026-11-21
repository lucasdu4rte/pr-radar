import { useMemo, useSyncExternalStore } from "react"

import { isDemo } from "@/lib/demo"
import type { RoleFilter } from "@/lib/pull-request-insights"

export type View = "inbox" | "focus"

export type SheetTab = "summary" | "files"

export type RadarFilters = {
  view: View
  role: RoleFilter
  query: string
  hideDrafts: boolean
  project: string | null
  account: string | null
  host: string | null
  pullRequest: string | null
  sheetTab: SheetTab
}

const DEFAULT_HOST = "github.com"
const VIEWS: View[] = ["inbox", "focus"]
const ROLES: RoleFilter[] = ["review", "mine", "all"]
const SHEET_TABS: SheetTab[] = ["summary", "files"]

function oneOf<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function parse(params: URLSearchParams): RadarFilters {
  return {
    view: oneOf(params.get("view"), VIEWS, "inbox"),
    role: oneOf(params.get("role"), ROLES, "review"),
    query: params.get("q") ?? "",
    hideDrafts: params.get("drafts") === "hide",
    project: params.get("project"),
    account: params.get("account"),
    host: params.get("host"),
    pullRequest: params.get("pr"),
    sheetTab: oneOf(params.get("tab"), SHEET_TABS, "summary"),
  }
}

function serialize(filters: RadarFilters) {
  const params = new URLSearchParams()
  if (isDemo()) params.set("demo", "")
  if (filters.account) params.set("account", filters.account)
  if (filters.host && filters.host !== DEFAULT_HOST) params.set("host", filters.host)
  if (filters.view !== "inbox") params.set("view", filters.view)
  if (filters.role !== "review") params.set("role", filters.role)
  if (filters.project) params.set("project", filters.project)
  if (filters.query) params.set("q", filters.query)
  if (filters.hideDrafts) params.set("drafts", "hide")
  if (filters.pullRequest) params.set("pr", filters.pullRequest)
  if (filters.pullRequest && filters.sheetTab !== "summary") params.set("tab", filters.sheetTab)
  return params.toString()
}

const LOCATION_CHANGE_EVENT = "pr-radar:location-change"

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange)
  window.addEventListener(LOCATION_CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener(LOCATION_CHANGE_EVENT, onChange)
  }
}

const currentSearch = () => window.location.search

/**
 * Filters live in the URL so a reload keeps the view. Each patch is applied
 * to the URL as it is now, so two updates in the same tick don't overwrite
 * each other.
 */
export function useRadarFilters() {
  const search = useSyncExternalStore(subscribe, currentSearch)
  const filters = useMemo(() => parse(new URLSearchParams(search)), [search])

  const setFilters = (patch: Partial<RadarFilters>) => {
    const latest = parse(new URLSearchParams(window.location.search))
    const next = serialize({ ...latest, ...patch })
    window.history.replaceState(null, "", next ? `?${next}` : window.location.pathname)
    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT))
  }

  return [filters, setFilters] as const
}

export const pullRequestParam = (repo: string, number: number) => `${repo}/${number}`
