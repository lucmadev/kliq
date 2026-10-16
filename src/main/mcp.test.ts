import { afterEach, describe, expect, it } from "vitest";
import { openDatabase, setDatabase } from "./db";
import { SECRET, secretSet, useSecretStore } from "./secrets";
import { runPrompt, runTool, startMcpServer, stopMcpServer, TOOL_NAMES, mcpListenPort } from "./mcp";

const REFRESH = "refresh-token-value";
const LLM_KEY = "sk-test-secret-value";
const BEARER = "mcp-bearer-token-value";

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
  secretSet(SECRET.refreshToken, REFRESH);
  secretSet(SECRET.llmKey, LLM_KEY);
  secretSet(SECRET.mcpBearer, BEARER);
  secretSet(SECRET.clientSecret, "super-secret-value");
}

describe("mcp tools", () => {
  afterEach(async () => {
    await stopMcpServer();
  });

  it("does not expose secrets, disconnect, or sql", async () => {
    memoryStore();
    const db = openDatabase(":memory:");
    setDatabase(db);
    expect(TOOL_NAMES).not.toContain("disconnect");
    expect(TOOL_NAMES.join(" ")).not.toMatch(/sql|secret|token/i);

    const status = await runTool(db, "get_status", {});
    const report = await runTool(db, "get_week_report", {});
    const videos = await runTool(db, "list_videos", { limit: 50 });
    const reach = await runTool(db, "get_reach", {});
    const log = await runTool(db, "get_sync_log", {});
    const prompt = runPrompt(db, "weekly_review", {});
    const dumped = JSON.stringify({ status, report, videos, reach, log, prompt });
    expect(dumped).not.toContain(REFRESH);
    expect(dumped).not.toContain(LLM_KEY);
    expect(dumped).not.toContain(BEARER);
    expect(dumped).not.toContain("super-secret-value");
    expect(status.isError).toBeUndefined();
  });

  it("rejects a request without the bearer token", async () => {
    memoryStore();
    setDatabase(openDatabase(":memory:"));
    await startMcpServer(0);
    const port = mcpListenPort();
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: "{}",
    });
    expect(response.status).toBe(403);
    const open = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(open.status).toBe(401);
    expect(await open.text()).not.toContain(BEARER);
  });
});
