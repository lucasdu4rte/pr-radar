import type { PullRequestFile } from "@/lib/types"

export type FileTreeNode =
  | { type: "directory"; name: string; path: string; children: FileTreeNode[]; additions: number; deletions: number }
  | { type: "file"; name: string; path: string; file: PullRequestFile }

type MutableDirectory = Extract<FileTreeNode, { type: "directory" }>

function directory(name: string, path: string): MutableDirectory {
  return { type: "directory", name, path, children: [], additions: 0, deletions: 0 }
}

function sortNodes(nodes: FileTreeNode[]) {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/** Merges chains of single-child directories into one node, like GitHub's "src/components/ui". */
function compress(node: FileTreeNode): FileTreeNode {
  if (node.type === "file") return node

  let current = node
  while (current.children.length === 1 && current.children[0].type === "directory") {
    const child = current.children[0]
    current = { ...child, name: `${current.name}/${child.name}` }
  }
  return { ...current, children: sortNodes(current.children.map(compress)) }
}

export function buildFileTree(files: PullRequestFile[]): FileTreeNode[] {
  const root = directory("", "")

  for (const file of files) {
    const segments = file.filename.split("/")
    let parent = root
    parent.additions += file.additions
    parent.deletions += file.deletions

    segments.slice(0, -1).forEach((segment, index) => {
      const path = segments.slice(0, index + 1).join("/")
      let next = parent.children.find((child): child is MutableDirectory => child.type === "directory" && child.path === path)
      if (!next) {
        next = directory(segment, path)
        parent.children.push(next)
      }
      next.additions += file.additions
      next.deletions += file.deletions
      parent = next
    })

    parent.children.push({ type: "file", name: segments.at(-1)!, path: file.filename, file })
  }

  return sortNodes(root.children.map(compress))
}
