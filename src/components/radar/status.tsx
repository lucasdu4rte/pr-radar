import { CheckIcon, CircleAlertIcon, LoaderCircleIcon, MinusIcon, UsersIcon, XIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ageLabel, isStaleReview } from "@/lib/pull-request-insights"
import type { CiState, PullRequest } from "@/lib/types"
import { cn } from "@/lib/utils"

const CI_DISPLAY: Record<CiState, { label: string; icon: typeof CheckIcon; className: string }> = {
  pass: { label: "CI ok", icon: CheckIcon, className: "text-emerald-600 dark:text-emerald-400" },
  fail: { label: "CI falhou", icon: XIcon, className: "text-red-600 dark:text-red-400" },
  pending: { label: "CI rodando", icon: LoaderCircleIcon, className: "text-amber-600 dark:text-amber-400" },
  none: { label: "Sem CI", icon: MinusIcon, className: "text-muted-foreground" },
}

export function CiStatus({ ci, compact = false }: { ci: CiState; compact?: boolean }) {
  const { label, icon: Icon, className } = CI_DISPLAY[ci]
  const iconElement = <Icon aria-hidden className={cn("size-4 shrink-0", ci === "pending" && "animate-spin [animation-duration:1.4s]")} />

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className={cn("grid place-items-center", className)} aria-label={label} />}>
          {iconElement}
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", className)}>
      {iconElement}
      {label}
    </span>
  )
}

function reviewSummary(pullRequest: PullRequest) {
  if (pullRequest.review === "changes") {
    return { label: "Mudanças", detail: "Pediram mudanças", icon: CircleAlertIcon, className: "text-red-600 dark:text-red-400" }
  }
  if (pullRequest.review === "approved") {
    return { label: "Aprovado", detail: "Aprovado", icon: CheckIcon, className: "text-emerald-600 dark:text-emerald-400" }
  }
  if (pullRequest.review === "none" && pullRequest.approvals === 0) {
    return { label: "—", detail: "Sem review obrigatória", icon: UsersIcon, className: "text-muted-foreground" }
  }

  const plural = pullRequest.approvals === 1 ? "aprovação" : "aprovações"
  return {
    label: pullRequest.approvals > 0 ? `${pullRequest.approvals} aprov.` : "Pendente",
    detail: `${pullRequest.approvals} ${plural}, falta review`,
    icon: UsersIcon,
    className: "text-muted-foreground",
  }
}

export function ReviewStatus({ pullRequest }: { pullRequest: PullRequest }) {
  const { label, detail, icon: Icon, className } = reviewSummary(pullRequest)
  return (
    <span title={detail} className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap tabular-nums", className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}

function sizedAvatarUrl(avatarUrl: string) {
  if (!avatarUrl) return undefined
  const url = new URL(avatarUrl)
  url.searchParams.set("s", "64")
  return url.toString()
}

export function AuthorAvatar({ login, avatarUrl, className }: { login: string; avatarUrl: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" aria-label={`@${login}`} />}>
        <Avatar className={cn("size-6", className)}>
          <AvatarImage src={sizedAvatarUrl(avatarUrl)} alt="" />
          <AvatarFallback className="text-[10px]">{login.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>@{login}</TooltipContent>
    </Tooltip>
  )
}

export function Age({ pullRequest, now }: { pullRequest: PullRequest; now: number }) {
  const stale = isStaleReview(pullRequest, now)
  return (
    <span
      title={stale ? "Esperando revisão há mais de 2 dias" : undefined}
      className={cn("font-mono text-xs tabular-nums", stale ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}
    >
      {ageLabel(pullRequest.createdAt, now)}
    </span>
  )
}

export function DraftBadge() {
  return (
    <Badge variant="outline" className="h-5 px-1.5 text-[11px] text-muted-foreground">
      draft
    </Badge>
  )
}
