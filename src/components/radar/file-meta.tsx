import type { PullRequestFileStatus } from "@/lib/types"

export const STATUS_DISPLAY: Record<PullRequestFileStatus, { letter: string; label: string; className: string }> = {
  added: { letter: "A", label: "Adicionado", className: "text-emerald-600 dark:text-emerald-400" },
  removed: { letter: "D", label: "Removido", className: "text-red-600 dark:text-red-400" },
  modified: { letter: "M", label: "Modificado", className: "text-amber-600 dark:text-amber-400" },
  renamed: { letter: "R", label: "Renomeado", className: "text-blue-600 dark:text-blue-400" },
  copied: { letter: "C", label: "Copiado", className: "text-blue-600 dark:text-blue-400" },
  changed: { letter: "M", label: "Alterado", className: "text-amber-600 dark:text-amber-400" },
  unchanged: { letter: "·", label: "Sem mudança", className: "text-muted-foreground" },
}

export const fileAnchorId = (filename: string) => `file-${filename.replace(/[^\w-]/g, "_")}`

export function scrollToFile(filename: string) {
  document.getElementById(fileAnchorId(filename))?.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function splitPath(filename: string) {
  const slash = filename.lastIndexOf("/")
  return { directory: slash === -1 ? "" : filename.slice(0, slash + 1), basename: filename.slice(slash + 1) }
}

export function DiffStat({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <span className="shrink-0 font-mono text-[11px] tabular-nums">
      <span className="text-emerald-600 dark:text-emerald-400">+{additions}</span>{" "}
      <span className="text-red-600 dark:text-red-400">−{deletions}</span>
    </span>
  )
}
