import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import { openUrl } from "@tauri-apps/plugin-opener"

export const openExternal = (url: string) => openUrl(url)

export const writeClipboard = (text: string) => writeText(text)

/** The webview never opens new windows, so every http(s) link is handed to the default browser instead. */
export function routeLinksToBrowser() {
  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null
    if (!anchor || !/^https?:/.test(anchor.href)) return
    event.preventDefault()
    void openExternal(anchor.href)
  })
}
