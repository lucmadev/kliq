import { existsSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  accountPath,
  accountTokenKey,
  activateAccount,
  activeAccountId,
  listAccountViews,
  adoptLegacyToken,
  closeAccounts,
  initAccounts,
  isAccountId,
  metaDatabase,
  rememberAccount,
  saveConnectedChannel,
} from "../src/main/accounts";
import { disconnectAccount, isConnected } from "../src/main/auth";
import { database, kvSet, openDatabase } from "../src/main/db";
import { SECRET, secretGet, secretSet, useSecretStore } from "../src/main/secrets";
import { loadSettings } from "../src/main/settings";

const idA = `UC${"a".repeat(22)}`;
const idB = `UC${"b".repeat(22)}`;

function memoryStore(): void {
  const memory = new Map<string, string>();
  useSecretStore({
    available: () => true,
    get: (key) => memory.get(key) ?? null,
    set: (key, value) => {
      if (value == null) memory.delete(key);
      else memory.set(key, value);
    },
  });
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "kliq-accounts-"));
}

afterEach(() => {
  closeAccounts();
});

describe("account store", () => {
  it("rejects ids that are not a channel or the demo", () => {
    expect(isAccountId(idA)).toBe(true);
    expect(isAccountId("demo")).toBe(true);
    expect(isAccountId("../etc")).toBe(false);
    expect(isAccountId("UCdemo")).toBe(false);
  });

  it("keeps each channel in its own file", () => {
    const dir = tempDir();
    initAccounts(dir, "en");
    rememberAccount(idA, "Alpha", null);
    rememberAccount(idB, "Beta", null);
    activateAccount(idA, "en", false);
    database().prepare("INSERT INTO channel VALUES (?,?,?,?,?,?,?)").run(idA, "Alpha", null, 10, 0, 1, "t");
    activateAccount(idB, "en", false);
    database().prepare("INSERT INTO channel VALUES (?,?,?,?,?,?,?)").run(idB, "Beta", null, 20, 0, 2, "t");
    activateAccount(idA, "en", false);
    expect((database().prepare("SELECT title FROM channel").get() as { title: string }).title).toBe("Alpha");
    activateAccount(idB, "en", false);
    expect((database().prepare("SELECT subscribers FROM channel").get() as { subscribers: number }).subscribers).toBe(20);
    expect(activeAccountId()).toBe(idB);
  });

  it("stores a refresh token per account and disconnects only that one", () => {
    memoryStore();
    initAccounts(tempDir(), "en");
    saveConnectedChannel("tok-a", { id: idA, title: "Alpha", thumbnail: null, subscribers: 1, views: 2, videoCount: 3 }, "en", false);
    saveConnectedChannel("tok-b", { id: idB, title: "Beta", thumbnail: null, subscribers: 4, views: 5, videoCount: 6 }, "en", false);
    expect(secretGet(accountTokenKey(idA))).toBe("tok-a");
    expect(activeAccountId()).toBe(idB);
    expect(isConnected()).toBe(true);
    disconnectAccount(idB);
    expect(isConnected()).toBe(false);
    expect(secretGet(accountTokenKey(idA))).toBe("tok-a");
    activateAccount(idA, "en", false);
    expect(isConnected()).toBe(true);
    const views = listAccountViews();
    expect(views.map((account) => account.id)).toEqual([idA, idB]);
    expect(views[0]?.active).toBe(true);
    expect(views[0]?.subscribers).toBe(1);
    expect(views[1]?.connected).toBe(false);
    expect(views[1]?.subscribers).toBe(4);
  });

  it("refuses to switch while a sync is running", () => {
    initAccounts(tempDir(), "en");
    rememberAccount(idA, "Alpha", null);
    rememberAccount(idB, "Beta", null);
    activateAccount(idA, "en", false);
    expect(() => activateAccount(idB, "en", true)).toThrow(/already running/i);
    expect(activeAccountId()).toBe(idA);
  });

  it("moves monitor.db onto the channel it already has and reassigns the single token", () => {
    memoryStore();
    const dir = tempDir();
    const legacy = openDatabase(join(dir, "monitor.db"));
    legacy.prepare("INSERT INTO channel VALUES (?,?,?,?,?,?,?)").run(idA, "Legacy", null, 3, 0, 1, "t");
    kvSet(legacy, "locale", "es");
    kvSet(legacy, "settings", JSON.stringify({ tz: "UTC" }));
    legacy.close();
    secretSet(SECRET.refreshToken, "legacy-token");
    initAccounts(dir, "en");
    adoptLegacyToken();
    expect(existsSync(join(dir, "monitor.db"))).toBe(false);
    expect(existsSync(accountPath(idA))).toBe(true);
    expect(activeAccountId()).toBe(idA);
    expect(secretGet(accountTokenKey(idA))).toBe("legacy-token");
    expect(secretGet(SECRET.refreshToken)).toBeNull();
    expect(loadSettings(metaDatabase()).tz).toBe("UTC");
    expect((database().prepare("SELECT title FROM channel").get() as { title: string }).title).toBe("Legacy");
  });

  it("moves a demo database without treating it as a Google account", () => {
    const dir = tempDir();
    const legacy = openDatabase(join(dir, "monitor.db"));
    legacy.prepare("INSERT INTO channel VALUES (?,?,?,?,?,?,?)").run("UCdemo", "Demo Channel", null, 1, 0, 1, "t");
    kvSet(legacy, "demo", "1");
    legacy.close();
    initAccounts(dir, "en");
    expect(activeAccountId()).toBe("demo");
    expect(existsSync(join(dir, "monitor.db"))).toBe(false);
    expect(isConnected()).toBe(false);
  });
});
