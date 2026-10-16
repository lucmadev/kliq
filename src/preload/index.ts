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
  importReach: (payload: { csv: string; periodStart: string; periodEnd: string }) =>
    ipcRenderer.invoke("import-reach", payload),
};

contextBridge.exposeInMainWorld("kliq", kliq);

export type KliqBridge = typeof kliq;
