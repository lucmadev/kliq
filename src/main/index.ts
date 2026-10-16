import { app, BrowserWindow, session, shell } from "electron";
import { join } from "node:path";
import { adoptLegacyToken, initAccounts, metaDatabase } from "./accounts";
import { isConnected } from "./auth";
import { peekDatabase } from "./db";
import { installKeychain } from "./keychain";
import { currentLocale, registerIpc } from "./ipc";
import { llmReady, summarizeReport } from "./llm";
import { setSummarizer } from "./report";
import { stopMcpServer, syncMcpWithSettings } from "./mcp";
import { startDailySync, syncedOnLocalDay } from "./schedule";
import { loadSettings } from "./settings";
import { runSync } from "./youtube";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
].join("; ");

function hardenSession(): void {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });
  if (!process.env.ELECTRON_RENDERER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [CSP],
        },
      });
    });
  }
}

function attachNavigationGuards(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (devUrl && url.startsWith(devUrl)) return;
    if (url.startsWith("file:")) return;
    event.preventDefault();
    if (url.startsWith("https:") || url.startsWith("http:")) shell.openExternal(url);
  });
}

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 880,
    minHeight: 640,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    roundedCorners: true,
    autoHideMenuBar: true,
    title: "Kliq",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const sendMaximized = (value: boolean) => {
    if (!win.isDestroyed()) win.webContents.send("window-maximized", value);
  };
  win.on("maximize", () => sendMaximized(true));
  win.on("unmaximize", () => sendMaximized(false));
  win.on("ready-to-show", () => win.show());
  attachNavigationGuards(win);

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return win;
}

app.whenReady().then(() => {
  initAccounts(app.getPath("userData"), app.getLocale());
  installKeychain(join(app.getPath("userData"), "secrets.json"), currentLocale);
  adoptLegacyToken();
  setSummarizer({
    enabled: () => llmReady(loadSettings(metaDatabase())),
    summarize: (report) => summarizeReport(metaDatabase(), report, currentLocale()),
  });
  startDailySync({
    timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    shouldRun: () => {
      const db = peekDatabase();
      if (!isConnected() || !db) return false;
      const row = db
        .prepare("SELECT finished_at FROM sync_log WHERE status = 'ok' ORDER BY id DESC LIMIT 1")
        .get() as { finished_at: string | null } | undefined;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      return !syncedOnLocalDay(row?.finished_at ?? null, new Date(), tz);
    },
    run: () => {
      const db = peekDatabase();
      if (db) void runSync(db);
    },
  });
  registerIpc();
  void syncMcpWithSettings(metaDatabase()).catch(() => console.error("mcp start failed"));
  hardenSession();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  void stopMcpServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
