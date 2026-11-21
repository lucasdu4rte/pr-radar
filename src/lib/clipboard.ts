import { toast } from "sonner"

import { writeClipboard } from "@/lib/native/external"

export async function copyToClipboard(text: string, successMessage: string) {
  try {
    await writeClipboard(text)
    toast.success(successMessage)
  } catch {
    toast.error("Couldn't copy. Select the text and copy it.")
  }
}
