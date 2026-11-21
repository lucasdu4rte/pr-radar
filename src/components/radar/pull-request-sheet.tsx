import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CheckIcon, CodeIcon, CopyIcon, ExternalLinkIcon, FileDiffIcon, LinkIcon, LoaderCircleIcon, ThumbsUpIcon } from "lucide-react"
import { toast } from "sonner"

import { PullRequestFiles, usePullRequestFiles } from "@/components/radar/pull-request-files"
import type { SheetTab } from "@/components/radar/use-radar-filters"
import { Age, AuthorAvatar, CiStatus, ReviewStatus } from "@/components/radar/status"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { copyToClipboard } from "@/lib/clipboard"
import { approvePullRequest } from "@/lib/github/pull-requests"
import { CloneNotFoundError, openPullRequestInEditor, readSearchRoots, storeSearchRoots } from "@/lib/local-checkout"
import { isStaleReview } from "@/lib/pull-request-insights"
import type { Account, PullRequest } from "@/lib/types"
import { cn } from "@/lib/utils"

type PullRequestSheetProps = {
  pullRequest: PullRequest | null
  account: Account
  now: number
  tab: SheetTab
  onTabChange: (tab: SheetTab) => void
  onClose: () => void
  onApproved: (pullRequestId: string) => void
}

function ApproveForm({ pullRequest, account, onDone, onCancel }: {
  pullRequest: PullRequest
  account: Account
  onDone: () => void
  onCancel: () => void
}) {
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)

  const submit = async () => {
    setSending(true)
    try {
      await approvePullRequest(account, pullRequest.id, comment)
      toast.success(`PR #${pullRequest.number} aprovado`)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não consegui aprovar")
      setSending(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-3">
        <label htmlFor="approve-comment" className="text-xs text-muted-foreground">
          Comentário da aprovação (opcional), enviado como {account.login}
        </label>
        <Textarea id="approve-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="LGTM" autoFocus />
        <div className="flex gap-2">
          <Button onClick={submit} disabled={sending} className="bg-emerald-600 text-white hover:bg-emerald-600/90">
            {sending ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
            {sending ? "Enviando…" : "Enviar aprovação"}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={sending}>
            Cancelar
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

function CloneRootsField({ onSaved }: { onSaved: () => void }) {
  const [roots, setRoots] = useState(readSearchRoots)

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    storeSearchRoots(roots)
    onSaved()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-1.5 rounded-lg border bg-muted/50 p-3">
      <label htmlFor="clone-roots" className="text-xs text-muted-foreground">
        Pastas onde procurar clones (separe com vírgula, busca até 3 níveis)
      </label>
      <div className="flex gap-2">
        <Input id="clone-roots" value={roots} onChange={(event) => setRoots(event.target.value)} placeholder="~/Apps, ~/work" className="font-mono text-xs" />
        <Button type="submit" variant="outline">
          Salvar e tentar
        </Button>
      </div>
    </form>
  )
}

function OpenInEditor({ pullRequest, account }: { pullRequest: PullRequest; account: Account }) {
  const [opening, setOpening] = useState(false)
  const [cloneMissing, setCloneMissing] = useState(false)
  const checkoutCommand = `gh pr checkout ${pullRequest.number} -R ${pullRequest.repo}`

  const open = async () => {
    setOpening(true)
    try {
      const { worktree } = await openPullRequestInEditor(account, pullRequest.repo, pullRequest.number)
      toast.success("Aberto no VS Code", { description: worktree })
      setCloneMissing(false)
    } catch (error) {
      setCloneMissing(error instanceof CloneNotFoundError)
      toast.error("Não consegui abrir no VS Code", { description: error instanceof Error ? error.message : undefined })
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Testar localmente</p>
      <Button variant="outline" onClick={open} disabled={opening} className="self-start">
        {opening ? <LoaderCircleIcon className="animate-spin" /> : <CodeIcon />}
        {opening ? "Preparando worktree…" : "Abrir no VS Code"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Faz checkout da branch numa worktree em ~/.pr-radar/worktrees e abre a pasta, sem mexer no seu clone.
      </p>
      {cloneMissing && <CloneRootsField onSaved={open} />}
      <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 font-mono text-xs">
        <span className="min-w-0 flex-1 break-all">{checkoutCommand}</span>
        <Button variant="ghost" size="icon-xs" aria-label="Copiar comando" onClick={() => copyToClipboard(checkoutCommand, "Comando copiado")}>
          <CopyIcon />
        </Button>
      </div>
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-2">{children}</dd>
    </>
  )
}

function SummaryTab({ pullRequest, account, now }: { pullRequest: PullRequest; account: Account; now: number }) {
  const totalLines = pullRequest.additions + pullRequest.deletions || 1

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
        <Detail label="Autor">
          <AuthorAvatar login={pullRequest.author.login} avatarUrl={pullRequest.author.avatarUrl} className="size-5" />
          {pullRequest.author.login}
        </Detail>
        <Detail label="Branch">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">{pullRequest.headRef}</code>→
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{pullRequest.baseRef}</code>
        </Detail>
        <Detail label="CI">
          <CiStatus ci={pullRequest.ci} />
        </Detail>
        <Detail label="Reviews">
          <ReviewStatus pullRequest={pullRequest} />
        </Detail>
        <Detail label="Comentários">
          <span className="font-mono text-xs tabular-nums">{pullRequest.comments}</span>
        </Detail>
        <Detail label="Aberto há">
          <Age pullRequest={pullRequest} now={now} />
          {isStaleReview(pullRequest, now) && <Badge variant="outline" className="text-amber-600 dark:text-amber-400">parado</Badge>}
        </Detail>
        <Detail label="Diff">
          <span className="flex w-full flex-col gap-1.5">
            <span className="font-mono text-xs tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">+{pullRequest.additions}</span>{" "}
              <span className="text-red-600 dark:text-red-400">−{pullRequest.deletions}</span>
            </span>
            <span className="flex h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="bg-emerald-500" style={{ width: `${(pullRequest.additions / totalLines) * 100}%` }} />
              <span className="bg-red-500" style={{ width: `${(pullRequest.deletions / totalLines) * 100}%` }} />
            </span>
          </span>
        </Detail>
      </dl>

      <OpenInEditor pullRequest={pullRequest} account={account} />
    </div>
  )
}

function PullRequestDetails({ pullRequest, account, now, tab, onTabChange, onApproved }: Omit<PullRequestSheetProps, "pullRequest" | "onClose"> & { pullRequest: PullRequest }) {
  const [approving, setApproving] = useState(false)
  const canApprove = pullRequest.role === "review" && !pullRequest.viewerApproved
  const { data: files } = usePullRequestFiles(account, pullRequest)

  return (
    <>
      <SheetHeader className="border-b pr-20">
        <span className="font-mono text-xs text-muted-foreground">
          {pullRequest.repo} #{pullRequest.number}
        </span>
        <SheetTitle className="text-base leading-snug text-balance">{pullRequest.title}</SheetTitle>
        <SheetDescription className="sr-only">Detalhes do pull request</SheetDescription>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-12"
          aria-label="Copiar link do PR"
          title="Copiar link do PR"
          onClick={() => copyToClipboard(pullRequest.url, "Link do PR copiado")}
        >
          <LinkIcon />
        </Button>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {canApprove && !approving && (
            <Button className="bg-emerald-600 text-white hover:bg-emerald-600/90" onClick={() => setApproving(true)}>
              <ThumbsUpIcon />
              Aprovar
            </Button>
          )}
          {pullRequest.viewerApproved && (
            <Badge className="h-8 gap-1 bg-emerald-600/10 px-3 text-emerald-700 dark:text-emerald-400">
              <CheckIcon />
              Você aprovou
            </Badge>
          )}
          <Button variant="outline" render={<a href={pullRequest.url} target="_blank" rel="noreferrer" />}>
            <ExternalLinkIcon />
            Abrir no GitHub
          </Button>
        </div>

        <AnimatePresence>
          {approving && (
            <ApproveForm
              pullRequest={pullRequest}
              account={account}
              onCancel={() => setApproving(false)}
              onDone={() => {
                setApproving(false)
                onApproved(pullRequest.id)
              }}
            />
          )}
        </AnimatePresence>

        <Tabs value={tab} onValueChange={(value) => onTabChange(value as SheetTab)} className="gap-4">
          <TabsList>
            <TabsTrigger value="summary" className="px-3">
              Resumo
            </TabsTrigger>
            <TabsTrigger value="files" className="px-3">
              <FileDiffIcon />
              Arquivos
              {files && (
                <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">{files.files.length}</span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <SummaryTab pullRequest={pullRequest} account={account} now={now} />
          </TabsContent>
          <TabsContent value="files">
            <PullRequestFiles pullRequest={pullRequest} account={account} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

export function PullRequestSheet({ pullRequest, open, onClose, ...rest }: PullRequestSheetProps & { open: boolean }) {
  return (
    <Sheet open={open && pullRequest !== null} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        className={cn(
          "gap-4 transition-[max-width] duration-300 ease-out data-[side=right]:w-full",
          rest.tab === "files" ? "data-[side=right]:sm:max-w-[min(1280px,96vw)]" : "data-[side=right]:sm:max-w-md",
        )}
      >
        {pullRequest && <PullRequestDetails key={pullRequest.id} pullRequest={pullRequest} {...rest} />}
      </SheetContent>
    </Sheet>
  )
}
