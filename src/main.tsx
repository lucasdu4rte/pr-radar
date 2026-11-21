import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"

import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"

import { RadarApp } from "@/components/radar/radar-app"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { routeLinksToBrowser } from "@/lib/native/external"

import "./styles.css"

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } })

routeLinksToBrowser()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RadarApp />
        </TooltipProvider>
      </QueryClientProvider>
      <Toaster position="bottom-center" />
    </ThemeProvider>
  </StrictMode>,
)
