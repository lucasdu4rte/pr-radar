"use client"

import { motion } from "motion/react"
import { CircleAlertIcon, ClockIcon, EyeIcon, GitMergeIcon, type LucideIcon } from "lucide-react"

import { Age, AuthorAvatar, CiStatus, DraftBadge, ReviewStatus } from "@/components/radar/status"
import { DiffStat } from "@/components/radar/file-meta"
import { PullRequestContextMenu } from "@/components/radar/pull-request-context-menu"
import { type FocusBucketKey, focusBuckets } from "@/lib/pull-request-insights"
import type { PullRequest } from "@/lib/types"
import { cn } from "@/lib/utils"

const BUCKETS: { key: FocusBucketKey; title: string; hint: string; icon: LucideIcon; tone: string }[] = [
  { key: "review", title: "Esperando sua revisão", hint: "Mais antigos primeiro. Laranja = parado há mais de 2 dias.", icon: EyeIcon, tone: "text-blue-600 dark:text-blue-400" },
  { key: "blocked", title: "Seus PRs bloqueados", hint: "CI falhou ou pediram mudanças.", icon: CircleAlertIcon, tone: "text-red-600 dark:text-red-400" },
  { key: "ready", title: "Prontos para merge", hint: "CI ok e review aprovada.", icon: GitMergeIcon, tone: "text-emerald-600 dark:text-emerald-400" },
  { key: "waiting", title: "Aguardando outros", hint: "CI rodando, falta review ou ainda é draft.", icon: ClockIcon, tone: "text-amber-600 dark:text-amber-400" },
]

function FocusCard({ pullRequest, index, onOpen, now }: { pullRequest: PullRequest; index: number; onOpen: () => void; now: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32, delay: Math.min(index, 12) * 0.03 }}
      onClick={onOpen}
      className="block w-full rounded-lg border bg-card p-3 text-left shadow-xs transition-shadow hover:shadow-md"
    >
      <span className="mb-1 block truncate font-mono text-[11px] text-muted-foreground">
        {pullRequest.repo} #{pullRequest.number}
      </span>
      <span className="mb-2 flex items-start gap-2">
        <span className="font-medium">{pullRequest.title}</span>
        {pullRequest.isDraft && <DraftBadge />}
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <AuthorAvatar login={pullRequest.author.login} avatarUrl={pullRequest.author.avatarUrl} className="size-5" />
        <CiStatus ci={pullRequest.ci} />
        <ReviewStatus pullRequest={pullRequest} />
        <DiffStat additions={pullRequest.additions} deletions={pullRequest.deletions} />
        <span className="ml-auto">
          <Age pullRequest={pullRequest} now={now} />
        </span>
      </span>
    </motion.button>
  )
}

export function FocusView({ pullRequests, onOpen, now }: { pullRequests: PullRequest[]; onOpen: (pullRequest: PullRequest) => void; now: number }) {
  const buckets = focusBuckets(pullRequests)
  let cardIndex = 0

  return (
    <div className="grid flex-1 grid-cols-1 content-start gap-4 p-4 md:grid-cols-2 2xl:grid-cols-4">
      {BUCKETS.map(({ key, title, hint, icon: Icon, tone }) => (
        <section key={key} className="min-w-0 overflow-hidden rounded-xl border bg-muted/30">
          <header className="border-b bg-background px-3 py-2.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Icon aria-hidden className={cn("size-4", tone)} />
              {title}
              <span className="ml-auto rounded-full bg-muted px-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">{buckets[key].length}</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          </header>
          <div className="flex flex-col gap-2 p-2">
            {buckets[key].length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nada nesta fila.</p>}
            {buckets[key].map((pullRequest) => (
              <PullRequestContextMenu key={pullRequest.id} pullRequest={pullRequest}>
                <FocusCard pullRequest={pullRequest} index={cardIndex++} onOpen={() => onOpen(pullRequest)} now={now} />
              </PullRequestContextMenu>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
