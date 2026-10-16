import { OAuth2Client } from "google-auth-library";
import { AppError } from "./errors";
import { SECRET, secretGet } from "./secrets";
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
