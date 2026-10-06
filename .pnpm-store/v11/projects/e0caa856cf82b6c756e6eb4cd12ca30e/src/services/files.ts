import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "./http";

export const filesService = {
  open(id: number): Promise<{ url: string }> {
    return api<{ url: string }>(`/files/${id}/open`, "GET");
  },
};
export async function openPrivateFile(id: number): Promise<void> {
  const result = await filesService.open(id);
  if ("__TAURI_INTERNALS__" in window) await openUrl(result.url);
  else window.open(result.url, "_blank", "noopener,noreferrer");
}
