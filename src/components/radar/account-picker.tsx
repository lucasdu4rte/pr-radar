import { useState } from "react"
import { CheckIcon, ChevronsUpDownIcon, TerminalIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Account } from "@/lib/types"

const accountKey = (account: Account) => `${account.host}/${account.login}`

function AccountAvatar({ account, className }: { account: Account; className?: string }) {
  const avatar = account.host === "github.com" ? `https://github.com/${account.login}.png?size=64` : undefined
  return (
    <Avatar className={className}>
      <AvatarImage src={avatar} alt="" />
      <AvatarFallback className="text-[10px]">{account.login.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

export function AccountPicker({ accounts, selected, onSelect }: {
  accounts: Account[]
  selected: Account
  onSelect: (account: Account) => void
}) {
  const [open, setOpen] = useState(false)

  if (accounts.length < 2) {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-sm font-medium">
        <AccountAvatar account={selected} className="size-5" />
        {selected.login}
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" className="gap-2 px-2.5" />}>
        <AccountAvatar account={selected} className="size-5" />
        {selected.login}
        <ChevronsUpDownIcon className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-1 p-1.5">
        <p className="px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Contas no gh</p>
        {accounts.map((account) => {
          const isSelected = accountKey(account) === accountKey(selected)
          return (
            <button
              key={accountKey(account)}
              role="menuitemradio"
              aria-checked={isSelected}
              onClick={() => {
                onSelect(account)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
            >
              <AccountAvatar account={account} className="size-7" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{account.login}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {account.host}
                  {account.active && " · ativa no terminal"}
                </span>
              </span>
              {isSelected && <CheckIcon className="size-4 text-primary" />}
            </button>
          )
        })}
        <p className="mt-1 flex gap-2 border-t px-2 pt-2 pb-1 text-xs text-muted-foreground">
          <TerminalIcon className="mt-0.5 size-3.5 shrink-0" />
          Vem de gh auth status. Trocar aqui não muda a conta ativa do terminal.
        </p>
      </PopoverContent>
    </Popover>
  )
}

export { accountKey }
