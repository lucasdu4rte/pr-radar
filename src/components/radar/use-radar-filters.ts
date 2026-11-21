"use client"

import { useSearchParams } from "next/navigation"

import type { RoleFilter } from "@/lib/pull-request-insights"

export type View = "inbox" | "focus"

export type RadarFilters = {
  view: View
  role: RoleFilter
  query: string
  hideDrafts: boolean
  project: string | null
  account: string | null
  host: string | null
  pullRequest: string | null
}

const DEFAULT_HOST = "github.com"
const VIEWS: View[] = ["inbox", "focus"]
const ROLES: RoleFilter[] = ["review", "mine", "all"]

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
  }
}

function serialize(filters: RadarFilters) {
  const params = new URLSearchParams()
  if (filters.account) params.set("account", filters.account)
  if (filters.host && filters.host !== DEFAULT_HOST) params.set("host", filters.host)
  if (filters.view !== "inbox") params.set("view", filters.view)
  if (filters.role !== "review") params.set("role", filters.role)
  if (filters.project) params.set("project", filters.project)
  if (filters.query) params.set("q", filters.query)
  if (filters.hideDrafts) params.set("drafts", "hide")
  if (filters.pullRequest) params.set("pr", filters.pullRequest)
  return params.toString()
}

/**
 * Filters live in the URL so a view can be bookmarked or shared. Writes use
 * history.replaceState, which Next.js keeps in sync with useSearchParams
 * without a navigation per keystroke.
 */
export function useRadarFilters() {
  const params = useSearchParams()
  const filters = parse(new URLSearchParams(params.toString()))

  const setFilters = (patch: Partial<RadarFilters>) => {
    const search = serialize({ ...filters, ...patch })
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname)
  }

  return [filters, setFilters] as const
}

export const pullRequestParam = (repo: string, number: number) => `${repo}/${number}`
