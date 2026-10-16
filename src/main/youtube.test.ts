import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "./db";
import { parseDuration, runSync } from "./youtube";

describe("youtube sync", () => {
  it("parses ISO 8601 durations", () => {
    expect(parseDuration("PT1H2M3S")).toBe(3723);
    expect(parseDuration("PT45S")).toBe(45);
    expect(parseDuration("P1DT1M")).toBe(86460);
    expect(parseDuration(null)).toBe(0);
  });

  it("refuses to sync without a Google account", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kliq-"));
    const db = openDatabase(join(dir, "monitor.db"));
    const result = await runSync(db);
    expect(result.status).toBe("error");
    db.close();
  });
});
