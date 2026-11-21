import { NextResponse } from "next/server"

import { CloneNotFoundError, openPullRequestInEditor } from "@/lib/server/local-checkout"
import { errorResponse, isValidRepo, parseAccount, rejectNonLocal } from "@/lib/server/request-guard"

export async function POST(request: Request) {
  const rejection = rejectNonLocal(request)
  if (rejection) return rejection

  const body = await request.json().catch(() => ({}))
  const account = parseAccount(body.login, body.host)
  if (!account) return errorResponse("Conta inválida", 400)
  if (!isValidRepo(body.repo)) return errorResponse("Repositório inválido", 400)
  if (!Number.isInteger(body.number) || body.number <= 0) return errorResponse("Número de PR inválido", 400)

  try {
    const result = await openPullRequestInEditor(account.login, account.host, body.repo, body.number)
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error, error instanceof CloneNotFoundError ? 404 : 500)
  }
}
