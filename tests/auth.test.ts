import { describe, expect, it } from "vitest";
import { bundledGoogleClient, isConnected } from "../src/main/auth";
import { SECRET, secretSet, useSecretStore } from "../src/main/secrets";

describe("bundled google client", () => {
  it("uses the compiled client and ignores a keychain override", () => {
    const memory = new Map<string, string>();
    useSecretStore({
      available: () => true,
      get: (key) => memory.get(key) ?? null,
      set: (key, value) => {
        if (value == null) memory.delete(key);
        else memory.set(key, value);
      },
    });
    secretSet(SECRET.clientId, "from-keychain");
    secretSet(SECRET.clientSecret, "keychain-secret");

    expect(bundledGoogleClient({ clientId: " app-id ", clientSecret: " app-secret " })).toEqual({
      clientId: "app-id",
      clientSecret: "app-secret",
    });
    expect(bundledGoogleClient({ clientId: "app-id", clientSecret: "" })).toBeNull();
    expect(bundledGoogleClient({ clientId: "", clientSecret: "app-secret" })).toBeNull();
    expect(JSON.stringify(bundledGoogleClient({ clientId: "app-id", clientSecret: "app-secret" }))).not.toContain("keychain");

    secretSet(SECRET.refreshToken, "refresh-token-value");
    expect(isConnected()).toBe(true);
  });
});
