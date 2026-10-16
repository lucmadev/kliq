import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importReach } from "../src/main/csv";
import { openDatabase } from "../src/main/db";
import { latestReach } from "../src/main/report";
import { seed } from "../src/main/seed";
import { listVideos, videoDetail } from "../src/main/videos";

function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), "kliq-"));
  return openDatabase(join(dir, "monitor.db"));
}

describe("videos and reach csv", () => {
  it("lists videos and fills a 90-day series", async () => {
    const db = tempDb();
    await seed(db);
    const videos = listVideos(db);
    expect(videos.length).toBeGreaterThan(0);
    expect(videos[0]).toHaveProperty("last7");
    const detail = videoDetail(db, videos[0].id, "en");
    expect(detail.daily).toHaveLength(90);
    expect(detail.retention.length).toBeGreaterThan(0);
    db.close();
  });

  it("imports a Spanish Studio CSV", async () => {
    const db = tempDb();
    await seed(db);
    const vid = (db.prepare("SELECT id FROM videos LIMIT 1").get() as { id: string }).id;
    const csv = [
      "Contenido,Título del video,Hora de publicación del video,Impresiones,Porcentaje de clics de las impresiones (%),Vistas",
      "Total,,,120000,5.1,9000",
      `${vid},Algo,"Oct 1, 2026",54321,"7,25",3000`,
    ].join("\n");
    expect(importReach(db, csv, "2030-01-01", "2030-01-28", "en")).toBe(1);
    const reach = latestReach(db);
    expect(reach?.period_end).toBe("2030-01-28");
    expect(reach?.rows[0].impressions).toBe(54321);
    expect(reach?.rows[0].ctr).toBe(7.25);
    db.close();
  });

  it("imports an English Studio CSV and rejects a bad file", async () => {
    const db = tempDb();
    await seed(db);
    const vid = (db.prepare("SELECT id FROM videos LIMIT 1").get() as { id: string }).id;
    const csv = `Content,Video title,Impressions,Impressions click-through rate (%)\n${vid},X,1000,4.2\n`;
    expect(importReach(db, csv, "2030-02-01", "2030-02-28", "en")).toBe(1);
    expect(() => importReach(db, "a,b\n1,2\n", "2030-02-01", "2030-02-28", "en")).toThrow(/impressions/i);
    db.close();
  });
});
