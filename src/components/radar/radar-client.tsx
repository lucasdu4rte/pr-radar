"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const RadarApp = dynamic(() => import("@/components/radar/radar-app").then((module) => module.RadarApp), { ssr: false })

export function RadarClient() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <RadarApp />
    </QueryClientProvider>
  )
}
