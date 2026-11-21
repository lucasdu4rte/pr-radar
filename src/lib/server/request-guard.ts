import { NextResponse } from "next/server"

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])

/**
 * These routes run gh/git with your tokens, so only same-machine requests are
 * accepted. Checking Host blocks DNS rebinding; checking Origin blocks other
 * sites from posting to the local server.
 */
export function rejectNonLocal(request: Request) {
  const hostname = (request.headers.get("host") ?? "").replace(/:\d+$/, "")
  if (!LOCAL_HOSTNAMES.has(hostname)) {
    return NextResponse.json({ error: "Somente acesso local" }, { status: 403 })
  }

  const origin = request.headers.get("origin")
  if (origin && !LOCAL_HOSTNAMES.has(new URL(origin).hostname)) {
    return NextResponse.json({ error: "Origem não permitida" }, { status: 403 })
  }

  return null
}

export function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error)
  return NextResponse.json({ error: message }, { status })
}

const ACCOUNT_PATTERN = /^[A-Za-z0-9-]+$/
const HOST_PATTERN = /^[A-Za-z0-9.-]+$/
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/

export function parseAccount(login: unknown, host: unknown) {
  if (typeof login !== "string" || !ACCOUNT_PATTERN.test(login)) return null
  const resolvedHost = typeof host === "string" && host ? host : "github.com"
  if (!HOST_PATTERN.test(resolvedHost)) return null
  return { login, host: resolvedHost }
}

export function isValidRepo(repo: unknown): repo is string {
  return typeof repo === "string" && REPO_PATTERN.test(repo)
}
