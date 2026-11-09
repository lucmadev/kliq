import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import { BrowserWindow, shell } from "electron";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { saveConnectedChannel, type ConnectedChannel } from "./accounts";
import { bundledGoogleClient, SCOPES } from "./auth";
import { AppError } from "./errors";
import { database } from "./db";
import { secretsAvailable } from "./secrets";
import { translate, type Locale } from "../shared/i18n";
import { isRunning, runSync } from "./youtube";

const pending = new Map<string, { verifier: string; at: number }>();
const TTL_MS = 10 * 60 * 1000;

function challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function notify(payload: { ok: boolean; message?: string }): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("auth-result", payload);
  }
}

function page(locale: Locale, ok: boolean): string {
  const text = translate(locale, ok ? "oauth.page_ok" : "oauth.page_fail");
  return `<!doctype html><meta charset="utf-8"><title>Kliq</title><p>${text}</p>`;
}

export function startLogin(locale: Locale): void {
  const creds = bundledGoogleClient();
  if (!creds) throw new AppError(translate(locale, "error.not_configured"));
  if (!secretsAvailable()) throw new AppError(translate(locale, "error.keychain"));
  const now = Date.now();
  for (const [state, item] of pending) {
    if (now - item.at > TTL_MS) pending.delete(state);
  }

  const server = http.createServer((req, res) => {
    const remote = req.socket.remoteAddress ?? "";
    const local = remote === "127.0.0.1" || remote === "::1" || remote.endsWith("127.0.0.1");
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const finish = (ok: boolean, message?: string) => {
      res.writeHead(ok ? 200 : 400, { "content-type": "text/html; charset=utf-8" });
      res.end(page(locale, ok));
      notify({ ok, message });
      server.close();
    };
    if (!local || url.pathname !== "/callback") {
      res.writeHead(404).end("Not found");
      return;
    }
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (url.searchParams.get("error") || !code || !state) {
      finish(false, translate(locale, "error.oauth_cancelled"));
      return;
    }
    void finishLogin(code, state, redirectUri, locale)
      .then((sync) => {
        finish(true);
        if (sync) void runSync(database());
      })
      .catch((err: unknown) => {
        console.error("oauth callback failed");
        const message = err instanceof AppError ? err.message : translate(locale, "error.oauth_generic");
        finish(false, message);
      });
  });

  let redirectUri = "";
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : 0;
    redirectUri = `http://127.0.0.1:${port}/callback`;
    const state = randomBytes(16).toString("base64url");
    const codeVerifier = randomBytes(32).toString("base64url");
    pending.set(state, { verifier: codeVerifier, at: Date.now() });
    const client = new OAuth2Client({ ...creds, redirectUri });
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent select_account",
      scope: SCOPES,
      state,
      code_challenge: challenge(codeVerifier),
      code_challenge_method: CodeChallengeMethod.S256,
    });
    void shell.openExternal(url);
  });
  setTimeout(() => server.close(), TTL_MS).unref();
}

async function identifyMine(refreshToken: string, locale: Locale): Promise<ConnectedChannel> {
  const creds = bundledGoogleClient();
  if (!creds) throw new AppError(translate(locale, "error.not_configured"));
  const client = new OAuth2Client(creds);
  client.setCredentials({ refresh_token: refreshToken });
  const yt = google.youtube({ version: "v3", auth: client });
  const resp = await yt.channels.list({ part: ["snippet", "statistics"], mine: true });
  const ch = resp.data.items?.[0];
  if (!ch?.id) throw new AppError(translate(locale, "error.no_channel"));
  return {
    id: ch.id,
    title: ch.snippet?.title ?? "",
    thumbnail: ch.snippet?.thumbnails?.default?.url ?? null,
    subscribers: Number(ch.statistics?.subscriberCount ?? 0),
    views: Number(ch.statistics?.viewCount ?? 0),
    videoCount: Number(ch.statistics?.videoCount ?? 0),
  };
}

async function finishLogin(code: string, state: string, redirectUri: string, locale: Locale): Promise<boolean> {
  const item = pending.get(state);
  pending.delete(state);
  if (!item || Date.now() - item.at > TTL_MS) throw new AppError(translate(locale, "error.oauth_state"));
  const creds = bundledGoogleClient();
  if (!creds) throw new AppError(translate(locale, "error.not_configured"));
  const client = new OAuth2Client({ ...creds, redirectUri });
  const { tokens } = await client.getToken({ code, codeVerifier: item.verifier });
  if (!tokens.refresh_token) throw new AppError(translate(locale, "error.oauth_no_refresh"));
  const busy = isRunning();
  saveConnectedChannel(tokens.refresh_token, await identifyMine(tokens.refresh_token, locale), locale, busy);
  return !busy;
}
