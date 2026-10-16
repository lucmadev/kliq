import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lastCompleteWeekStart } from "../src/main/dates";
import { openDatabase } from "../src/main/db";
import { buildRange, buildReport, availableWeeks, previousPeriod, reachForPeriod } from "../src/main/report";
import { seed } from "../src/main/seed";
import { getReport, getStatus } from "../src/main/status";

function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), "kliq-"));
  return openDatabase(join(dir, "monitor.db"));
}

describe("dates", () => {
  it("finds the last complete week", () => {
    expect(lastCompleteWeekStart("2026-10-12")).toBe("2026-10-05");
    expect(lastCompleteWeekStart("2026-10-11")).toBe("2026-10-05");
    expect(lastCompleteWeekStart("2026-10-10")).toBe("2026-09-28");
  });
});

describe("demo report", () => {
  it("builds weeks, KPIs, and the saved report", async () => {
    const db = tempDb();
    await seed(db);
    const status = getStatus(db, {
      configured: false,
      connected: false,
      syncing: false,
      nextSync: null,
      llm: { provider: "none", enabled: false },
    });
    expect(status.demo).toBe(true);
    expect(status.videos).toBeGreaterThan(10);
    expect(status.data_range).toBeTruthy();

    const weeks = availableWeeks(db);
    expect(weeks.length).toBeGreaterThanOrEqual(5);

    const report = getReport(db);
    expect(report.week.start).toBe(weeks[0]);
    expect(report.complete).toBe(true);
    expect(report.kpis.map((k) => k.key)).toEqual(
      expect.arrayContaining(["views", "watch_hours", "net_subs"]),
    );
    expect(report.daily).toHaveLength(7);
    expect(report.daily.every((d) => d.current != null)).toBe(true);
    const share = report.traffic.reduce((s, t) => s + t.share, 0);
    expect(Math.abs(share - 100)).toBeLessThan(1);
    expect(report.videos.length).toBeGreaterThan(0);
    expect(report.insights.length).toBeGreaterThan(0);

    const saved = db.prepare("SELECT data FROM reports WHERE week_start=?").get(weeks[0]) as { data: string };
    expect(saved).toBeTruthy();
    expect(JSON.parse(saved.data).week.start).toBe(weeks[0]);

    const older = buildReport(db, weeks[3]);
    expect(older?.week.start).toBe(weeks[3]);

    const month = buildRange(db, "2026-09-01", "2026-09-30");
    expect(month?.daily.length).toBeGreaterThan(7);
    expect(month?.search_terms).toEqual([]);
    expect(previousPeriod("2026-09-01", "2026-09-30")).toEqual({ start: "2026-08-01", end: "2026-08-31" });
    expect(previousPeriod("2026-01-01", "2026-12-31")).toEqual({ start: "2025-01-01", end: "2025-12-31" });
    db.close();
  });
});

describe("impressions", () => {
  it("sums daily impressions and weights the click-through rate", () => {
    const db = tempDb();
    db.prepare("INSERT INTO reach_daily VALUES (?,?,?,?)").run("2026-05-04", "abcdefghijk", 100, 10);
    db.prepare("INSERT INTO reach_daily VALUES (?,?,?,?)").run("2026-05-05", "abcdefghijk", 300, 2);
    const daily = reachForPeriod(db, "2026-05-04", "2026-05-05");
    expect(daily?.rows[0]?.impressions).toBe(400);
    expect(daily?.rows[0]?.ctr).toBe(4);
    db.prepare("INSERT INTO reach VALUES (?,?,?,?,?)").run("2026-04-01", "2026-04-30", "abcdefghijk", 50, 8);
    const imported = reachForPeriod(db, "2026-04-10", "2026-04-12");
    expect(imported?.rows[0]?.impressions).toBe(50);
    expect(imported?.rows[0]?.ctr).toBe(8);
    db.close();
  });
});
