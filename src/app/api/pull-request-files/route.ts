import { NextResponse } from "next/server"

import { fetchPullRequestFiles } from "@/lib/server/pull-requests"
import { errorResponse, isValidRepo, parseAccount, rejectNonLocal } from "@/lib/server/request-guard"

export async function GET(request: Request) {
  const rejection = rejectNonLocal(request)
  if (rejection) return rejection

  const params = new URL(request.url).searchParams
  const account = parseAccount(params.get("login"), params.get("host"))
  if (!account) return errorResponse("Conta inválida", 400)

  const repo = params.get("repo")
  if (!isValidRepo(repo)) return errorResponse("Repositório inválido", 400)

  const number = Number(params.get("number"))
  if (!Number.isInteger(number) || number <= 0) return errorResponse("Número de PR inválido", 400)

  try {
    return NextResponse.json(await fetchPullRequestFiles(account.login, account.host, repo, number))
  } catch (error) {
    return errorResponse(error, 502)
  }
}
