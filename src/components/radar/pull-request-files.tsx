"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { ChevronDownIcon, ExternalLinkIcon, FileIcon } from "lucide-react"

import { DiffStat, fileAnchorId, STATUS_DISPLAY, splitPath } from "@/components/radar/file-meta"
import { FileNav } from "@/components/radar/file-nav"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { type DiffLine, type DiffLineKind, parsePatch } from "@/lib/diff"
import { type HighlightedLines, type HighlightedToken, highlightDiff } from "@/lib/syntax-highlight"
import type { Account, PullRequest, PullRequestFile, PullRequestFilesResponse } from "@/lib/types"
import { cn } from "@/lib/utils"

const COLLAPSED_BY_DEFAULT = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|go\.sum|composer\.lock)$/
const LARGE_PATCH_LINES = 600

const ROW_CLASS: Record<DiffLineKind, string> = {
  add: "bg-emerald-500/10",
  del: "bg-red-500/10",
  context: "",
  hunk: "bg-blue-500/10 text-muted-foreground",
  note: "text-muted-foreground italic",
}

const NUMBER_CELL_CLASS: Record<DiffLineKind, string> = {
  add: "bg-emerald-500/15",
  del: "bg-red-500/15",
  context: "",
  hunk: "",
  note: "",
}

const MARKER: Record<DiffLineKind, string> = { add: "+", del: "−", context: " ", hunk: "", note: "" }

function LineContent({ text, tokens }: { text: string; tokens: HighlightedToken[] | null | undefined }) {
  if (!tokens) return text
  return tokens.map((token, index) => (
    <span key={index} className="shiki-token" style={token.style as React.CSSProperties}>
      {token.content}
    </span>
  ))
}

function DiffTable({ lines, highlighted }: { lines: DiffLine[]; highlighted: HighlightedLines | undefined }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-xs leading-5">
        <tbody>
          {lines.map((line, index) => {
            if (line.kind === "hunk" || line.kind === "note") {
              return (
                <tr key={index} className={ROW_CLASS[line.kind]}>
                  <td colSpan={4} className="px-3 py-0.5 whitespace-pre">
                    {line.text}
                  </td>
                </tr>
              )
            }
            const numberCell = cn("w-12 min-w-12 px-2 text-right text-muted-foreground/70 tabular-nums select-none", NUMBER_CELL_CLASS[line.kind])
            return (
              <tr key={index} className={ROW_CLASS[line.kind]}>
                <td className={numberCell}>{line.oldNumber}</td>
                <td className={numberCell}>{line.newNumber}</td>
                <td className="w-4 text-center text-muted-foreground select-none">{MARKER[line.kind]}</td>
                <td className="pr-4 whitespace-pre">
                  <LineContent text={line.text} tokens={highlighted?.[index]} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FileDiff({ file, filesUrl }: { file: PullRequestFile; filesUrl: string }) {
  const lines = useMemo(() => (file.patch ? parsePatch(file.patch) : []), [file.patch])
  const [open, setOpen] = useState(() => !COLLAPSED_BY_DEFAULT.test(file.filename) && lines.length <= LARGE_PATCH_LINES)
  const { data: highlighted } = useQuery({
    queryKey: ["highlight", file.filename, file.patch],
    queryFn: () => highlightDiff(file.filename, lines),
    enabled: open && lines.length > 0,
    staleTime: Infinity,
  })
  const status = STATUS_DISPLAY[file.status]
  const { directory, basename } = splitPath(file.filename)

  return (
    <section id={fileAnchorId(file.filename)} className="scroll-mt-2 overflow-hidden rounded-lg border">
      <button
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 bg-muted/60 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
      >
        <ChevronDownIcon className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", !open && "-rotate-90")} />
        <span title={status.label} className={cn("w-3 shrink-0 font-mono text-xs font-semibold", status.className)}>
          {status.letter}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          {file.previousFilename && <span className="text-muted-foreground">{file.previousFilename} → </span>}
          <span className="text-muted-foreground">{directory}</span>
          <span className="font-medium">{basename}</span>
        </span>
        <DiffStat additions={file.additions} deletions={file.deletions} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="overflow-hidden border-t"
          >
            {lines.length > 0 ? (
              <DiffTable lines={lines} highlighted={highlighted} />
            ) : (
              <p className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                Sem diff para mostrar (arquivo binário, renomeado sem mudança ou grande demais).
                <a href={filesUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  Ver no GitHub
                </a>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

async function getFiles(account: Account, pullRequest: PullRequest) {
  const params = new URLSearchParams({ login: account.login, host: account.host, repo: pullRequest.repo, number: String(pullRequest.number) })
  const response = await fetch(`/api/pull-request-files?${params}`, { cache: "no-store" })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error ?? `Falha (${response.status})`)
  return payload as PullRequestFilesResponse
}

export function usePullRequestFiles(account: Account, pullRequest: PullRequest) {
  return useQuery({
    queryKey: ["pull-request-files", account.host, account.login, pullRequest.repo, pullRequest.number, pullRequest.updatedAt],
    queryFn: () => getFiles(account, pullRequest),
    staleTime: 5 * 60_000,
  })
}

export function PullRequestFiles({ account, pullRequest }: { account: Account; pullRequest: PullRequest }) {
  const { data, error, isPending, refetch } = usePullRequestFiles(account, pullRequest)
  const filesUrl = `${pullRequest.url}/files`

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-2 py-6 text-sm">
        <p className="font-medium">Não consegui carregar os arquivos</p>
        <p className="text-muted-foreground">{error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      </div>
    )
  }

  if (data.files.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Este PR não altera nenhum arquivo.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[230px_minmax(0,1fr)]">
      <FileNav files={data.files} />
      <div className="flex min-w-0 flex-col gap-3">
        {data.truncated && (
          <p className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <FileIcon className="size-3.5" />
            Mostrando os primeiros {data.files.length} arquivos.
            <a href={filesUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
              Ver todos no GitHub <ExternalLinkIcon className="size-3" />
            </a>
          </p>
        )}
        {data.files.map((file) => (
          <FileDiff key={file.filename} file={file} filesUrl={filesUrl} />
        ))}
      </div>
    </div>
  )
}
