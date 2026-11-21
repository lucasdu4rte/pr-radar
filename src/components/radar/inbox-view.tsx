"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { FolderGit2Icon, InboxIcon } from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Age, AuthorAvatar, CiStatus, DraftBadge, ReviewStatus } from "@/components/radar/status"
import { PullRequestContextMenu } from "@/components/radar/pull-request-context-menu"
import { groupByRepo, isBlocked, splitRepo } from "@/lib/pull-request-insights"
import type { PullRequest } from "@/lib/types"
import { cn } from "@/lib/utils"

type InboxViewProps = {
  pullRequests: PullRequest[]
  project: string | null
  onProjectChange: (repo: string | null) => void
  onOpen: (pullRequest: PullRequest) => void
  now: number
}

function groupSummary(pullRequests: PullRequest[]) {
  const waiting = pullRequests.filter((pullRequest) => pullRequest.role === "review").length
  const blocked = pullRequests.filter((pullRequest) => pullRequest.role === "mine" && isBlocked(pullRequest)).length
  return [waiting && `${waiting} esperando você`, blocked && `${blocked} bloqueado${blocked > 1 ? "s" : ""}`]
    .filter(Boolean)
    .join(" · ")
}

function ProjectNav({ groups, total, project, onProjectChange }: {
  groups: ReturnType<typeof groupByRepo>
  total: number
  project: string | null
  onProjectChange: (repo: string | null) => void
}) {
  const item = (active: boolean) =>
    cn(
      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:whitespace-normal",
      active && "bg-muted text-foreground",
    )

  return (
    <nav aria-label="Projetos" className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 md:w-60 md:flex-col md:overflow-visible md:border-r md:border-b-0">
      <button className={item(project === null)} onClick={() => onProjectChange(null)}>
        <InboxIcon className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">Todos os projetos</span>
        <span className="rounded-full bg-background px-1.5 font-mono text-[11px] tabular-nums">{total}</span>
      </button>
      <p className="hidden px-2 pt-3 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground uppercase md:block">Projetos</p>
      {groups.map((group) => (
        <button key={group.repo} title={group.repo} className={item(project === group.repo)} onClick={() => onProjectChange(group.repo)}>
          <FolderGit2Icon className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">{splitRepo(group.repo).name}</span>
          <span className="rounded-full bg-background px-1.5 font-mono text-[11px] tabular-nums">{group.pullRequests.length}</span>
        </button>
      ))}
    </nav>
  )
}

function PullRequestRow({ pullRequest, index, onOpen, now }: { pullRequest: PullRequest; index: number; onOpen: () => void; now: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 12) * 0.025, ease: [0.2, 0.8, 0.3, 1] }}
      onClick={onOpen}
      className="grid w-full grid-cols-[20px_minmax(0,1fr)_24px_36px] items-center gap-3 border-t px-4 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:grid-cols-[20px_minmax(0,1fr)_96px_24px_36px]"
    >
      <CiStatus ci={pullRequest.ci} compact />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{pullRequest.title}</span>
          {pullRequest.isDraft && <DraftBadge />}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          #{pullRequest.number} · {pullRequest.headRef}
        </span>
      </span>
      <span className="hidden sm:block">
        <ReviewStatus pullRequest={pullRequest} />
      </span>
      <AuthorAvatar login={pullRequest.author.login} avatarUrl={pullRequest.author.avatarUrl} />
      <span className="text-right">
        <Age pullRequest={pullRequest} now={now} />
      </span>
    </motion.button>
  )
}

export function InboxView({ pullRequests, project, onProjectChange, onOpen, now }: InboxViewProps) {
  const groups = groupByRepo(pullRequests)
  const visibleGroups = project ? groups.filter((group) => group.repo === project) : groups
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const openRepos = visibleGroups.map((group) => group.repo).filter((repo) => !collapsed.has(repo))
  let rowIndex = 0

  const handleOpenChange = (nextOpen: string[]) => {
    const open = new Set(nextOpen)
    setCollapsed(new Set(visibleGroups.map((group) => group.repo).filter((repo) => !open.has(repo))))
  }

  if (groups.length === 0) {
    return <p className="flex-1 py-24 text-center text-sm text-muted-foreground">Nenhum PR aberto neste filtro.</p>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <ProjectNav groups={groups} total={pullRequests.length} project={project} onProjectChange={onProjectChange} />
      <section className="min-w-0 flex-1">
        <Accordion multiple value={openRepos} onValueChange={(value) => handleOpenChange(value as string[])}>
          {visibleGroups.map((group) => {
            const { owner, name } = splitRepo(group.repo)
            const summary = groupSummary(group.pullRequests)
            return (
              <AccordionItem key={group.repo} value={group.repo} className="border-b">
                <AccordionTrigger className="items-center rounded-none bg-muted/50 px-4 py-2.5 hover:no-underline">
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate">
                      <span className="font-normal text-muted-foreground">{owner}/</span>
                      {name}
                    </span>
                    <span className="rounded-full bg-background px-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {group.pullRequests.length}
                    </span>
                    {summary && <span className="ml-auto hidden pr-3 text-xs font-normal text-muted-foreground sm:block">{summary}</span>}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  {group.pullRequests.map((pullRequest) => (
                    <PullRequestContextMenu key={pullRequest.id} pullRequest={pullRequest}>
                      <PullRequestRow pullRequest={pullRequest} index={rowIndex++} onOpen={() => onOpen(pullRequest)} now={now} />
                    </PullRequestContextMenu>
                  ))}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </section>
    </div>
  )
}
