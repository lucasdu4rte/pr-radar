# Radar de PRs

Lista local dos seus PRs abertos e dos pedidos de revisão, agrupados por projeto, usando as contas já logadas no `gh`.

## Rodar

```sh
npm install
npm run dev   # http://127.0.0.1:4823
```

Requer o `gh` logado (`gh auth status`). Cada conta usa o próprio token (`gh auth token --user <login>`), então trocar de conta no app não muda a conta ativa do terminal. Um `GH_TOKEN` no ambiente é ignorado de propósito.

## Abrir no VS Code

O botão procura um clone do repo nas pastas de `PR_RADAR_ROOTS` (padrão `~/Apps`, até 3 níveis, separadas por `:`), cria uma worktree em `~/.pr-radar/worktrees/<owner>/<repo>/pr-<n>`, roda `gh pr checkout` nela e abre com `code`.

```sh
PR_RADAR_ROOTS="~/Apps:~/work" npm run dev
```

## Segurança

O servidor escuta só em `127.0.0.1` e as rotas de API recusam `Host`/`Origin` que não sejam locais, porque elas executam `gh`/`git` com seus tokens.
