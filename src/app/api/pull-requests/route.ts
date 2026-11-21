import { NextResponse } from "next/server"

import { fetchPullRequests } from "@/lib/server/pull-requests"
import { errorResponse, parseAccount, rejectNonLocal } from "@/lib/server/request-guard"

export async function GET(request: Request) {
  const rejection = rejectNonLocal(request)
  if (rejection) return rejection

  const params = new URL(request.url).searchParams
  const account = parseAccount(params.get("login"), params.get("host"))
  if (!account) return errorResponse("Conta inválida", 400)

  try {
    return NextResponse.json(await fetchPullRequests(account.login, account.host))
  } catch (error) {
    return errorResponse(error, 502)
  }
}
