# Radar de PRs

App desktop (Tauri) com seus PRs abertos e os pedidos de revisão, agrupados por projeto, usando as contas já logadas no `gh`.

## Rodar

Requer Node (via fnm, `.node-version`), Rust (`cargo`) e o `gh` logado (`gh auth status`).

```sh
pnpm install
pnpm app          # tauri dev: janela com hot reload
pnpm app:build    # gera src-tauri/target/release/bundle/macos/Radar de PRs.app
```

`pnpm dev` sobe só o front no navegador (http://127.0.0.1:1420), mas sem Tauri as chamadas ao `gh` falham.

Cada conta usa o próprio token (`gh auth token --user <login>`), então trocar de conta no app não muda a conta ativa do terminal. Um `GH_TOKEN` exportado no shell é ignorado de propósito.

## Arquitetura

- Front: Vite + React + Tailwind + shadcn/animate-ui, tudo em TypeScript (`src/`).
- Nada de servidor Node: o TypeScript roda `gh`/`git` pelo plugin shell do Tauri e chama a API do GitHub direto com o token da conta.
- Rust (`src-tauri/`) só registra os plugins e corrige o `PATH` quando o app é aberto pelo Finder.
- Permissões em `src-tauri/capabilities/default.json`: só `gh` e `git`, leitura dentro de `$HOME` e abrir pastas de `~/.pr-radar/worktrees` no VS Code.

## Abrir no VS Code

O botão procura um clone do repo nas pastas configuradas (padrão `~/Apps`, até 3 níveis; dá para mudar no próprio app quando o clone não é achado), cria uma worktree em `~/.pr-radar/worktrees/<owner>/<repo>/pr-<n>`, roda `gh pr checkout` nela e abre no VS Code.
