import { describe, expect, it } from "vitest";
import { clientView, isConnected, saveClient } from "../src/main/auth";
import { SECRET, secretSet, useSecretStore } from "../src/main/secrets";

describe("oauth client view", () => {
  it("shows a hint and never the full secret", () => {
    const memory = new Map<string, string>();
    useSecretStore({
      available: () => true,
      get: (key) => memory.get(key) ?? null,
      set: (key, value) => {
        if (value == null) memory.delete(key);
        else memory.set(key, value);
      },
    });
    saveClient("client-id", "super-secret-value", "en");
    const view = clientView();
    expect(view.clientId).toBe("client-id");
    expect(view.secretHint).toBe("alue");
    expect(JSON.stringify(view)).not.toContain("super-secret-value");
    secretSet(SECRET.refreshToken, "refresh-token-value");
    expect(isConnected()).toBe(true);
    expect(JSON.stringify(clientView())).not.toContain("refresh-token-value");
  });
});
