export type DiffLineKind = "add" | "del" | "context" | "hunk" | "note"

export type DiffLine = {
  kind: DiffLineKind
  oldNumber: number | null
  newNumber: number | null
  text: string
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/** Parses the unified-diff `patch` GitHub returns per file into numbered lines. */
export function parsePatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = []
  let oldNumber = 0
  let newNumber = 0

  for (const raw of patch.split("\n")) {
    const hunk = raw.match(HUNK_HEADER)
    if (hunk) {
      oldNumber = Number(hunk[1])
      newNumber = Number(hunk[2])
      lines.push({ kind: "hunk", oldNumber: null, newNumber: null, text: raw })
      continue
    }

    if (raw.startsWith("\\")) {
      lines.push({ kind: "note", oldNumber: null, newNumber: null, text: raw.slice(2) })
      continue
    }

    const marker = raw[0]
    const text = raw.slice(1)
    if (marker === "+") {
      lines.push({ kind: "add", oldNumber: null, newNumber: newNumber++, text })
      continue
    }
    if (marker === "-") {
      lines.push({ kind: "del", oldNumber: oldNumber++, newNumber: null, text })
      continue
    }
    lines.push({ kind: "context", oldNumber: oldNumber++, newNumber: newNumber++, text })
  }

  return lines
}
