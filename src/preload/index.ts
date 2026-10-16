import { contextBridge, ipcRenderer } from "electron";
import type { Locale } from "../shared/i18n";

const kliq = {
  version: "0.1.0",
  locale: (): Promise<Locale> => ipcRenderer.invoke("locale"),
  setLocale: (locale: Locale): Promise<Locale> => ipcRenderer.invoke("set-locale", locale),
  status: () => ipcRenderer.invoke("status"),
  weeks: () => ipcRenderer.invoke("weeks"),
  report: (week?: string) => ipcRenderer.invoke("report", week),
  seedDemo: () => ipcRenderer.invoke("seed-demo"),
  summarize: (week: string) => ipcRenderer.invoke("summarize", week),
  videos: () => ipcRenderer.invoke("videos"),
  video: (id: string) => ipcRenderer.invoke("video", id),
  retention: (id: string) => ipcRenderer.invoke("retention", id),
  sync: () => ipcRenderer.invoke("sync"),
  disconnect: () => ipcRenderer.invoke("disconnect"),
  client: () => ipcRenderer.invoke("client"),
  saveClient: (payload: { clientId: string; clientSecret: string }) => ipcRenderer.invoke("save-client", payload),
  connect: () => ipcRenderer.invoke("connect"),
  onAuth: (cb: (result: { ok: boolean; message?: string }) => void) => {
    const listener = (_event: unknown, result: { ok: boolean; message?: string }) => cb(result);
    ipcRenderer.on("auth-result", listener);
    return () => {
      ipcRenderer.removeListener("auth-result", listener);
    };
  },
  importReach: (payload: { csv: string; periodStart: string; periodEnd: string }) =>
    ipcRenderer.invoke("import-reach", payload),
};

contextBridge.exposeInMainWorld("kliq", kliq);

export type KliqBridge = typeof kliq;
