import { NextResponse } from "next/server"

import { listAccounts } from "@/lib/server/gh"
import { errorResponse, rejectNonLocal } from "@/lib/server/request-guard"

export async function GET(request: Request) {
  const rejection = rejectNonLocal(request)
  if (rejection) return rejection

  try {
    return NextResponse.json({ accounts: await listAccounts() })
  } catch (error) {
    return errorResponse(error)
  }
}
