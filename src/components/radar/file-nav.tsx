import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ChevronRightIcon, FolderIcon, FolderOpenIcon, FolderTreeIcon, ListIcon } from "lucide-react"

import { DiffStat, STATUS_DISPLAY, scrollToFile, splitPath } from "@/components/radar/file-meta"
import { buildFileTree, type FileTreeNode } from "@/lib/file-tree"
import type { PullRequestFile } from "@/lib/types"
import { cn } from "@/lib/utils"

type FileNavMode = "tree" | "list"

const MODE_STORAGE_KEY = "pr-radar:file-nav-mode"
const INDENT_PX = 12

function readStoredMode(): FileNavMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "list" ? "list" : "tree"
  } catch {
    return "tree"
  }
}

function storeMode(mode: FileNavMode) {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode)
  } catch {}
}

const rowClass = "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs transition-colors hover:bg-muted"

function StatusLetter({ file }: { file: PullRequestFile }) {
  const status = STATUS_DISPLAY[file.status]
  return (
    <span title={status.label} className={cn("w-3 shrink-0 font-mono font-semibold", status.className)}>
      {status.letter}
    </span>
  )
}

function FileList({ files }: { files: PullRequestFile[] }) {
  return files.map((file) => {
    const { directory, basename } = splitPath(file.filename)
    return (
      <button key={file.filename} title={file.filename} onClick={() => scrollToFile(file.filename)} className={cn(rowClass, "pl-2")}>
        <StatusLetter file={file} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{basename}</span>
          {directory && <span className="block truncate text-[11px] text-muted-foreground">{directory}</span>}
        </span>
        <DiffStat additions={file.additions} deletions={file.deletions} />
      </button>
    )
  })
}

function TreeNodes({ nodes, depth, collapsed, onToggle }: {
  nodes: FileTreeNode[]
  depth: number
  collapsed: Set<string>
  onToggle: (path: string) => void
}) {
  return nodes.map((node) => {
    const paddingLeft = 8 + depth * INDENT_PX

    if (node.type === "file") {
      return (
        <button key={node.path} title={node.path} onClick={() => scrollToFile(node.path)} className={rowClass} style={{ paddingLeft: paddingLeft + 18 }}>
          <StatusLetter file={node.file} />
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          <DiffStat additions={node.file.additions} deletions={node.file.deletions} />
        </button>
      )
    }

    const isOpen = !collapsed.has(node.path)
    const FolderGlyph = isOpen ? FolderOpenIcon : FolderIcon
    return (
      <div key={node.path}>
        <button onClick={() => onToggle(node.path)} aria-expanded={isOpen} title={node.path} className={rowClass} style={{ paddingLeft }}>
          <ChevronRightIcon className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-90")} />
          <FolderGlyph className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              className="overflow-hidden"
            >
              <TreeNodes nodes={node.children} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  })
}

function ModeToggle({ mode, onChange }: { mode: FileNavMode; onChange: (mode: FileNavMode) => void }) {
  const option = (value: FileNavMode, label: string, Icon: typeof ListIcon) => (
    <button
      aria-pressed={mode === value}
      aria-label={label}
      title={label}
      onClick={() => onChange(value)}
      className={cn(
        "grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground",
        mode === value && "bg-background text-foreground shadow-xs",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  )

  return (
    <div className="flex rounded-lg bg-muted p-0.5">
      {option("tree", "Ver como árvore", FolderTreeIcon)}
      {option("list", "Ver como lista", ListIcon)}
    </div>
  )
}

export function FileNav({ files }: { files: PullRequestFile[] }) {
  const [mode, setMode] = useState<FileNavMode>(readStoredMode)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const tree = useMemo(() => buildFileTree(files), [files])

  const changeMode = (next: FileNavMode) => {
    storeMode(next)
    setMode(next)
  }

  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  return (
    <nav aria-label="Arquivos alterados" className="sticky top-0 hidden max-h-[calc(100dvh-12rem)] flex-col gap-1 md:flex">
      <div className="flex items-center justify-between gap-2 px-2 pb-1">
        <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{files.length} arquivos</span>
        <ModeToggle mode={mode} onChange={changeMode} />
      </div>
      <div className="flex flex-col gap-0.5 overflow-y-auto">
        {mode === "tree" ? <TreeNodes nodes={tree} depth={0} collapsed={collapsed} onToggle={toggle} /> : <FileList files={files} />}
      </div>
    </nav>
  )
}
