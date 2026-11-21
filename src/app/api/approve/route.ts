import { NextResponse } from "next/server"

import { approvePullRequest } from "@/lib/server/pull-requests"
import { errorResponse, parseAccount, rejectNonLocal } from "@/lib/server/request-guard"

export async function POST(request: Request) {
  const rejection = rejectNonLocal(request)
  if (rejection) return rejection

  const body = await request.json().catch(() => ({}))
  const account = parseAccount(body.login, body.host)
  if (!account) return errorResponse("Conta inválida", 400)
  if (typeof body.pullRequestId !== "string" || !body.pullRequestId) return errorResponse("PR inválido", 400)

  const comment = typeof body.comment === "string" ? body.comment.trim() : ""

  try {
    await approvePullRequest(account.login, account.host, body.pullRequestId, comment)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error, 502)
  }
}
