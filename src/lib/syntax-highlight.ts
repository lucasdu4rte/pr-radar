import type { BundledLanguage } from "shiki"

import type { DiffLine } from "@/lib/diff"

export type HighlightedToken = { content: string; style: Record<string, string> }

export type HighlightedLines = (HighlightedToken[] | null)[]

const MAX_HIGHLIGHT_LINES = 4000

const LANGUAGE_BY_FILENAME: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "make",
  "cmakelists.txt": "cmake",
  gemfile: "ruby",
  rakefile: "ruby",
  ".gitignore": "gitignore",
  ".dockerignore": "gitignore",
  ".env": "dotenv",
  ".env.example": "dotenv",
  ".bashrc": "bash",
  ".zshrc": "zsh",
  ".zshenv": "zsh",
}

async function detectLanguage(filename: string): Promise<BundledLanguage | null> {
  const { bundledLanguages } = await import("shiki")
  const basename = filename.slice(filename.lastIndexOf("/") + 1).toLowerCase()
  const extension = basename.includes(".") ? basename.slice(basename.lastIndexOf(".") + 1) : null
  const candidates = [LANGUAGE_BY_FILENAME[basename], extension]
  const match = candidates.find((candidate) => candidate && candidate in bundledLanguages)
  return (match as BundledLanguage | undefined) ?? null
}

async function tokenize(code: string, lang: BundledLanguage) {
  const { codeToTokens } = await import("shiki")
  const { tokens } = await codeToTokens(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  })
  return tokens.map((line) => line.map((token) => ({ content: token.content, style: token.htmlStyle ?? {} })))
}

/**
 * Highlights the old side (context + removed) and the new side (context +
 * added) as two continuous snippets, so multi-line constructs like block
 * comments and template strings keep their colors across lines.
 */
export async function highlightDiff(filename: string, lines: DiffLine[]): Promise<HighlightedLines> {
  const unhighlighted: HighlightedLines = lines.map(() => null)
  if (lines.length > MAX_HIGHLIGHT_LINES) return unhighlighted

  const lang = await detectLanguage(filename)
  if (!lang) return unhighlighted

  const oldSide: number[] = []
  const newSide: number[] = []
  lines.forEach((line, index) => {
    if (line.kind === "context" || line.kind === "del") oldSide.push(index)
    if (line.kind === "context" || line.kind === "add") newSide.push(index)
  })

  const joinSide = (side: number[]) => side.map((index) => lines[index].text).join("\n")
  const [oldTokens, newTokens] = await Promise.all([tokenize(joinSide(oldSide), lang), tokenize(joinSide(newSide), lang)])

  const result = [...unhighlighted]
  newSide.forEach((lineIndex, position) => (result[lineIndex] = newTokens[position] ?? null))
  oldSide.forEach((lineIndex, position) => {
    if (lines[lineIndex].kind === "del") result[lineIndex] = oldTokens[position] ?? null
  })
  return result
}
