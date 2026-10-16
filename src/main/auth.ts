import { OAuth2Client } from "google-auth-library";
import { AppError } from "./errors";
import { SECRET, secretGet, secretSet, secretsAvailable } from "./secrets";
import { translate, type Locale } from "../shared/i18n";

export const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export function isConfigured(): boolean {
  return Boolean(secretGet(SECRET.clientId) && secretGet(SECRET.clientSecret));
}

export function isConnected(): boolean {
  return Boolean(secretGet(SECRET.refreshToken));
}

export function clientView(): { clientId: string; secretHint: string | null } {
  const secret = secretGet(SECRET.clientSecret);
  return {
    clientId: secretGet(SECRET.clientId) ?? "",
    secretHint: secret ? secret.slice(-4) : null,
  };
}

export function saveClient(clientId: string, clientSecret: string, locale: Locale): void {
  if (!secretsAvailable()) throw new AppError(translate(locale, "error.keychain"));
  const id = clientId.trim();
  if (!id) throw new AppError(translate(locale, "error.not_configured"));
  secretSet(SECRET.clientId, id);
  const nextSecret = clientSecret.trim();
  if (nextSecret) secretSet(SECRET.clientSecret, nextSecret);
  else if (!secretGet(SECRET.clientSecret)) throw new AppError(translate(locale, "error.not_configured"));
}

export function disconnectAccount(): void {
  secretSet(SECRET.refreshToken, null);
}

export async function loadClient(locale: Locale): Promise<OAuth2Client> {
  const clientId = secretGet(SECRET.clientId);
  const clientSecret = secretGet(SECRET.clientSecret);
  const refreshToken = secretGet(SECRET.refreshToken);
  if (!clientId || !clientSecret) throw new AppError(translate(locale, "error.not_configured"));
  if (!refreshToken) throw new AppError(translate(locale, "error.not_connected"));
  const client = new OAuth2Client({ clientId, clientSecret });
  client.setCredentials({ refresh_token: refreshToken });
  await client.getAccessToken();
  return client;
}
