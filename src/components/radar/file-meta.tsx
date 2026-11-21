import type { PullRequestFileStatus } from "@/lib/types"

export const STATUS_DISPLAY: Record<PullRequestFileStatus, { letter: string; label: string; className: string }> = {
  added: { letter: "A", label: "Added", className: "text-emerald-600 dark:text-emerald-400" },
  removed: { letter: "D", label: "Removed", className: "text-red-600 dark:text-red-400" },
  modified: { letter: "M", label: "Modified", className: "text-amber-600 dark:text-amber-400" },
  renamed: { letter: "R", label: "Renamed", className: "text-blue-600 dark:text-blue-400" },
  copied: { letter: "C", label: "Copied", className: "text-blue-600 dark:text-blue-400" },
  changed: { letter: "M", label: "Changed", className: "text-amber-600 dark:text-amber-400" },
  unchanged: { letter: "·", label: "Unchanged", className: "text-muted-foreground" },
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
