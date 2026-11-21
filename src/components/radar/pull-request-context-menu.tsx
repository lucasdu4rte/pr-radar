import { ExternalLinkIcon, LinkIcon } from "lucide-react"

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { copyToClipboard } from "@/lib/clipboard"
import { openExternal } from "@/lib/native/external"
import type { PullRequest } from "@/lib/types"

export function PullRequestContextMenu({ pullRequest, children }: { pullRequest: PullRequest; children: React.ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="block select-auto">{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={() => openExternal(pullRequest.url)}>
          <ExternalLinkIcon />
          Abrir PR
        </ContextMenuItem>
        <ContextMenuItem onClick={() => copyToClipboard(pullRequest.url, "Link do PR copiado")}>
          <LinkIcon />
          Copiar link
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
