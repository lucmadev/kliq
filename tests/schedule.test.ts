import { describe, expect, it } from "vitest";
import { localDateKey, nextLocalMidnight, syncedOnLocalDay } from "../src/main/schedule";

describe("daily sync clock", () => {
  it("waits until the next local midnight and treats a successful sync as done for that day", () => {
    const evening = new Date("2026-10-15T22:00:00.000Z");
    expect(localDateKey(evening, "America/Argentina/Buenos_Aires")).toBe("2026-10-15");
    expect(nextLocalMidnight(evening, "America/Argentina/Buenos_Aires").toISOString()).toBe("2026-10-16T03:00:00.000Z");
    expect(syncedOnLocalDay("2026-10-15T12:00:00.000Z", evening, "America/Argentina/Buenos_Aires")).toBe(true);
    expect(syncedOnLocalDay("2026-10-14T12:00:00.000Z", evening, "America/Argentina/Buenos_Aires")).toBe(false);
  });
});