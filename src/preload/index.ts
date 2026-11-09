import { contextBridge, ipcRenderer } from "electron";
import type { Locale } from "../shared/i18n";
import type { AccentId, ThemeChoice } from "../shared/theme";

const kliq = {
  version: "0.1.0",
  locale: (): Promise<Locale> => ipcRenderer.invoke("locale"),
  setLocale: (locale: Locale): Promise<Locale> => ipcRenderer.invoke("set-locale", locale),
  theme: (): Promise<ThemeChoice> => ipcRenderer.invoke("theme"),
  setTheme: (theme: ThemeChoice): Promise<ThemeChoice> => ipcRenderer.invoke("set-theme", theme),
  accent: (): Promise<AccentId> => ipcRenderer.invoke("accent"),
  setAccent: (accent: AccentId): Promise<AccentId> => ipcRenderer.invoke("set-accent", accent),
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowToggleMaximize: (): Promise<boolean> => ipcRenderer.invoke("window-toggle-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  onWindowMaximized: (cb: (maximized: boolean) => void) => {
    const listener = (_event: unknown, maximized: boolean) => cb(maximized);
    ipcRenderer.on("window-maximized", listener);
    return () => {
      ipcRenderer.removeListener("window-maximized", listener);
    };
  },
  onAccount: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on("account-changed", listener);
    return () => {
      ipcRenderer.removeListener("account-changed", listener);
    };
  },
  status: () => ipcRenderer.invoke("status"),
  weeks: () => ipcRenderer.invoke("weeks"),
  report: (payload?: string | { start: string; end: string }) => ipcRenderer.invoke("report", payload),
  seedDemo: () => ipcRenderer.invoke("seed-demo"),
  summarize: (payload: string | { start: string; end: string }) => ipcRenderer.invoke("summarize", payload),
  onboarded: (): Promise<boolean> => ipcRenderer.invoke("onboarded"),
  finishOnboard: () => ipcRenderer.invoke("finish-onboard"),
  videos: () => ipcRenderer.invoke("videos"),
  video: (id: string) => ipcRenderer.invoke("video", id),
  retention: (id: string) => ipcRenderer.invoke("retention", id),
  sync: () => ipcRenderer.invoke("sync"),
  accounts: () => ipcRenderer.invoke("accounts"),
  activateAccount: (id: string) => ipcRenderer.invoke("activate-account", id),
  disconnect: (id: string) => ipcRenderer.invoke("disconnect", id),
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
  settings: () => ipcRenderer.invoke("settings"),
  saveSettings: (payload: unknown) => ipcRenderer.invoke("save-settings", payload),
  saveLlmKey: (key: string) => ipcRenderer.invoke("save-llm-key", key),
  clearLlmKey: () => ipcRenderer.invoke("clear-llm-key"),
  mcp: () => ipcRenderer.invoke("mcp"),
  saveMcp: (payload: { enabled: boolean; port: number }) => ipcRenderer.invoke("save-mcp", payload),
  rotateMcp: () => ipcRenderer.invoke("rotate-mcp"),
  copyMcp: () => ipcRenderer.invoke("copy-mcp"),
};

contextBridge.exposeInMainWorld("kliq", kliq);

export type KliqBridge = typeof kliq;
