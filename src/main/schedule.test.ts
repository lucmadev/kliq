import { describe, expect, it } from "vitest";
import { nextDailyRun } from "./schedule";

describe("daily sync clock", () => {
  it("fires at 06:07 in Buenos Aires and rolls to the next day after that", () => {
    const before = new Date("2026-10-15T08:00:00.000Z");
    expect(nextDailyRun(before, "America/Argentina/Buenos_Aires", 6).toISOString()).toBe("2026-10-15T09:07:00.000Z");
    const after = new Date("2026-10-15T10:00:00.000Z");
    expect(nextDailyRun(after, "America/Argentina/Buenos_Aires", 6).toISOString()).toBe("2026-10-16T09:07:00.000Z");
  });
});
