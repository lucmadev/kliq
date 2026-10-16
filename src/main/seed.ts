/** Demo data so the UI can be used without a Google account. */
import type Database from "better-sqlite3";
import { addDays, daterange, lastCompleteWeekStart } from "./dates";
import { kvSet, nowIso } from "./db";
import { autoGenerateReports } from "./report";

const TITLES = [
  "I built a dual Xeon server for less than a laptop",
  "Docker in 10 minutes: the part nobody explains",
  "I ran a local LLM on 2016 hardware",
  "I automate my PC with AI agents",
  "Tool calling, explained with a real example",
  "My terminal setup for 2026",
  "I tried 5 local models: the underdog won",
  "How I deploy without breaking production",
  "3D printing: I turned failed prints into bricks",
  "An agent that reads my email (and does not ruin it)",
  "Ollama vs llama.cpp: an honest benchmark",
  "I made a Discord bot for roleplay with AI",
  "An open-source Minecraft plugin from scratch",
  "A cheap home lab: what to buy and what to skip",
  "My one-person DevOps workflow",
  "Is a used GPU worth it for AI?",
  "I built an autonomous trash can",
  "Proxmox for beginners",
  "Fine-tuning at home: expectation vs reality",
  "I monitor my channel without paying for vidIQ",
];

const TERMS = [
  "local llm", "docker tutorial", "ollama", "xeon server", "home lab",
  "ai agents", "tool calling", "proxmox", "llama.cpp", "gpu for ai", "automate pc",
  "minecraft paper plugin", "discord roleplay bot", "devops", "3d printing recycling",
];

const SOURCES: Record<string, number> = {
  BROWSE: 0.34,
  RELATED_VIDEO: 0.27,
  YT_SEARCH: 0.18,
  SUBSCRIBER: 0.06,
  EXT_URL: 0.05,
  NO_LINK_OTHER: 0.04,
  PLAYLIST: 0.03,
  NOTIFICATION: 0.02,
  YT_CHANNEL: 0.01,
};

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uniform(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  randint(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  choice<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  sample<T>(items: T[], k: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    for (let i = 0; i < k && pool.length; i++) {
      const idx = Math.floor(this.next() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }
  normal(mu: number, sigma: number): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return z * sigma + mu;
  }
  lognorm(mu: number, sigma: number): number {
    return Math.exp(this.normal(mu, sigma));
  }
}

function vid(rng: Rng): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  return Array.from({ length: 11 }, () => rng.choice([...alphabet])).join("");
}

type DemoVideo = {
  id: string;
  title: string;
  published: string;
  quality: number;
  duration: number;
  short: boolean;
};

export async function seed(db: Database.Database, days = 160, seedValue = 7): Promise<number> {
  const rng = new Rng(seedValue);
  const end = addDays(new Date().toISOString().slice(0, 10), -2);
  const start = addDays(end, -(days - 1));

  const videos: DemoVideo[] = [];
  let pub = addDays(start, -60);
  let i = 0;
  while (pub <= end) {
    let quality = rng.lognorm(0, 0.6);
    if (i === 9 || i === 16) quality *= 5;
    const part = i < TITLES.length ? "" : ` (part ${Math.floor(i / TITLES.length) + 1})`;
    videos.push({
      id: vid(rng),
      title: TITLES[i % TITLES.length] + part,
      published: pub,
      quality,
      duration: rng.randint(240, 1500),
      short: rng.next() < 0.15,
    });
    pub = addDays(pub, rng.choice([4, 5, 7, 7, 9]));
    i++;
  }

  const totals = new Map(videos.map((v) => [v.id, 0]));
  const insertVideoDaily = db.prepare("INSERT INTO video_daily VALUES (?,?,?,?,?,?)");
  const insertChannel = db.prepare("INSERT INTO channel_daily VALUES (?,?,?,?,?,?,?,?,?)");
  const insertTraffic = db.prepare("INSERT INTO traffic_daily VALUES (?,?,?,?)");

  const fill = db.transaction(() => {
    for (const t of [
      "channel", "videos", "video_snapshots", "channel_daily", "video_daily",
      "traffic_daily", "search_terms", "retention", "reach", "reports", "sync_log",
    ]) {
      db.prepare(`DELETE FROM ${t}`).run();
    }

    for (const d of daterange(start, end)) {
      let dayViews = 0;
      let dayWm = 0;
      let daySubs = 0;
      const weekdayBoost = utcWeekday(d) >= 5 ? 1.15 : 1;
      for (const v of videos) {
        const age = daysBetween(v.published, d);
        if (age < 0) continue;
        const launch = 900 * v.quality * Math.exp(-age / 3.5);
        const tail = 60 * v.quality * Math.exp(-age / 90) + 4 * v.quality;
        let wake = 1;
        const wakeVideo = videos[Math.min(16, videos.length - 1)];
        if (v === wakeVideo && age > 20) wake = 1 + Math.min(age - 20, 30) / 10;
        const views = Math.floor(Math.max(0, (launch + tail) * wake * weekdayBoost * rng.uniform(0.75, 1.25)));
        if (!views) continue;
        const avd = v.short ? 38 : v.duration * rng.uniform(0.32, 0.48);
        const wm = (views * avd) / 60;
        const subs = Math.floor(views * rng.uniform(0.004, 0.012));
        insertVideoDaily.run(d, v.id, views, round1(wm), round1(avd), subs);
        totals.set(v.id, (totals.get(v.id) ?? 0) + views);
        dayViews += views;
        dayWm += wm;
        daySubs += subs;
      }
      const lost = Math.floor(daySubs * rng.uniform(0.1, 0.25));
      const likes = Math.floor(dayViews * 0.035);
      insertChannel.run(
        d,
        dayViews,
        round1(dayWm),
        dayViews ? round1((dayWm * 60) / dayViews) : 0,
        daySubs,
        lost,
        likes,
        Math.floor(dayViews * 0.004),
        Math.floor(dayViews * 0.002),
      );
      const drift = Math.max(0, daysBetween(addDays(end, -21), d)) / 21;
      const weights = { ...SOURCES, RELATED_VIDEO: SOURCES.RELATED_VIDEO + 0.15 * drift };
      const norm = Object.values(weights).reduce((a, b) => a + b, 0);
      for (const [s, w] of Object.entries(weights)) {
        const sv = Math.floor(dayViews * (w / norm) * rng.uniform(0.85, 1.15));
        insertTraffic.run(d, s, sv, round1((sv * dayWm) / Math.max(dayViews, 1)));
      }
    }

    const insertVideo = db.prepare("INSERT INTO videos VALUES (?,?,?,?,?,?,?,?,?)");
    const stamp = nowIso();
    for (const v of videos) {
      const accrued = totals.get(v.id) ?? 0;
      const total = v.published < start ? accrued + Math.floor(800 * v.quality) : accrued;
      insertVideo.run(
        v.id,
        v.title,
        `${v.published}T18:00:00Z`,
        v.duration,
        null,
        total,
        Math.floor(total * 0.035),
        Math.floor(total * 0.004),
        stamp,
      );
    }

    db.prepare("INSERT INTO channel VALUES (?,?,?,?,?,?,?)").run(
      "UCdemo",
      "Demo Channel",
      null,
      4200,
      [...totals.values()].reduce((a, b) => a + b, 0),
      videos.length,
      stamp,
    );

    const ws = lastCompleteWeekStart(end);
    const insertTerm = db.prepare("INSERT INTO search_terms VALUES (?,?,?)");
    [ws, addDays(ws, -7)].forEach((week, k) => {
      for (const term of rng.sample(TERMS, 10 - k * 2)) {
        insertTerm.run(week, term, rng.randint(15, 400));
      }
    });

    const insertRet = db.prepare("INSERT INTO retention VALUES (?,?,?,?)");
    for (const v of videos.slice(-5)) {
      for (let step = 0; step <= 100; step++) {
        const x = step / 100;
        const watch = Math.max(0.05, 1 * Math.exp(-2.2 * x) * (0.95 + 0.1 * rng.next()) + (x > 0.92 ? 0.08 : 0));
        insertRet.run(v.id, x, round3(watch), round2(rng.uniform(0.3, 0.8)));
      }
    }

    const ps = addDays(end, -27);
    const insertReach = db.prepare("INSERT INTO reach VALUES (?,?,?,?,?)");
    for (const v of videos) {
      const imp = Math.floor((totals.get(v.id) ?? 0) * rng.uniform(6, 14));
      if (imp < 100) continue;
      const ctr = v.quality < 3 ? round2(rng.uniform(2, 9.5)) : round2(rng.uniform(8, 13));
      insertReach.run(ps, end, v.id, imp, ctr);
    }

    db.prepare("INSERT INTO sync_log (started_at, finished_at, status, detail) VALUES (?,?,?,?)").run(
      stamp,
      stamp,
      "ok",
      "demo data",
    );
  });

  fill();
  kvSet(db, "demo", "1");
  await autoGenerateReports(db);
  return videos.length;
}

function utcWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
