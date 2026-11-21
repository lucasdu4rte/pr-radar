import { Command } from "@tauri-apps/plugin-shell"

export type Program = "gh" | "git"

const TOKEN_VARIABLES = ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"]

/**
 * A token exported in the login shell would override every gh account. gh
 * treats an empty variable as unset, so blanking them lets the chosen
 * account's token (or gh's own keyring) win.
 */
function tokenEnv(token?: string) {
  const env: Record<string, string> = Object.fromEntries(TOKEN_VARIABLES.map((name) => [name, ""]))
  if (token) env.GH_TOKEN = token
  return env
}

export async function run(program: Program, args: string[], options: { token?: string; cwd?: string } = {}) {
  const output = await Command.create(program, args, { cwd: options.cwd, env: tokenEnv(options.token) }).execute()
  if (output.code !== 0) throw new Error(output.stderr.trim() || `${program} terminou com código ${output.code}`)
  return output.stdout
}
