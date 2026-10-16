/** In-memory stand-in until the OS keychain store is installed at startup. */

type SecretStore = {
  available: () => boolean;
  get: (key: string) => string | null;
  set: (key: string, value: string | null) => void;
};

const memory = new Map<string, string>();

let store: SecretStore = {
  available: () => false,
  get: (key) => memory.get(key) ?? null,
  set: () => {
    throw new Error("Secret store is not ready");
  },
};

export function useSecretStore(next: SecretStore): void {
  store = next;
}

export function secretsAvailable(): boolean {
  return store.available();
}

export function secretGet(key: string): string | null {
  return store.get(key);
}

export function secretSet(key: string, value: string | null): void {
  store.set(key, value);
}

export const SECRET = {
  clientId: "google_client_id",
  clientSecret: "google_client_secret",
  refreshToken: "google_refresh_token",
  llmKey: "llm_api_key",
  mcpBearer: "mcp_bearer",
} as const;
