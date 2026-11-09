import { OAuth2Client } from "google-auth-library";
import { accountTokenKey, activeAccountId, DEMO_ID, metaReady } from "./accounts";
import { AppError } from "./errors";
import { SECRET, secretGet, secretSet } from "./secrets";
import { translate, type Locale } from "../shared/i18n";

export const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export type GoogleClientEnv = { clientId?: string; clientSecret?: string };

export function bundledGoogleClient(env?: GoogleClientEnv): { clientId: string; clientSecret: string } | null {
  const source = env ?? {
    clientId: import.meta.env.GOOGLE_CLIENT_ID,
    clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET,
  };
  const clientId = source.clientId?.trim() ?? "";
  const clientSecret = source.clientSecret?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isConfigured(): boolean {
  return bundledGoogleClient() != null;
}

export function isConnected(): boolean {
  if (!metaReady()) return Boolean(secretGet(SECRET.refreshToken));
  const id = activeAccountId();
  if (!id || id === DEMO_ID) return false;
  return Boolean(secretGet(accountTokenKey(id)));
}

export function disconnectAccount(id: string): void {
  if (!id || id === DEMO_ID) return;
  secretSet(accountTokenKey(id), null);
}

export async function loadClient(locale: Locale): Promise<OAuth2Client> {
  const google = bundledGoogleClient();
  const id = activeAccountId();
  const refreshToken = metaReady()
    ? (id && id !== DEMO_ID ? secretGet(accountTokenKey(id)) : null)
    : secretGet(SECRET.refreshToken);
  if (!google) throw new AppError(translate(locale, "error.not_configured"));
  if (!refreshToken) throw new AppError(translate(locale, "error.not_connected"));
  const client = new OAuth2Client(google);
  client.setCredentials({ refresh_token: refreshToken });
  await client.getAccessToken();
  return client;
}
