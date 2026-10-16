/** Stand-in so the type checker does not load the real Google auth declarations. */

export class OAuth2Client {
  constructor(_options?: { clientId?: string; clientSecret?: string; redirectUri?: string }) {}

  setCredentials(_tokens: { refresh_token?: string | null }): void {}

  getAccessToken(): Promise<{ token?: string | null }> {
    return Promise.resolve({});
  }

  generateAuthUrl(_options: {
    access_type?: string;
    prompt?: string;
    scope?: string[];
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
  }): string {
    return "";
  }

  getToken(_options: { code: string; codeVerifier?: string }): Promise<{ tokens: { refresh_token?: string | null } }> {
    return Promise.resolve({ tokens: {} });
  }
}

export const CodeChallengeMethod = {
  S256: "S256",
} as const;
