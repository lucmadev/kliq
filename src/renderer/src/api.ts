export type Kpi = {
  key: string;
  label: string;
  unit: "num" | "secs";
  current: number;
  previous: number;
  delta_pct: number | null;
};

export type TrafficRow = {
  source: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  delta_pct: number | null;
  share: number;
};

export type VideoWeek = {
  id: string;
  title: string;
  thumbnail: string | null;
  published_at: string | null;
  views: number;
  previous: number;
  delta_pct: number | null;
  watch_hours: number;
  subs: number;
  ratio_vs_median: number | null;
  flag: "nuevo" | "outlier" | "subiendo" | "cayendo" | null;
};

export type Launch = {
  id: string;
  title: string;
  published_at: string;
  days: number;
  views: number;
  baseline: number | null;
  ratio: number | null;
};

export type Reach = {
  period_start: string;
  period_end: string;
  median_ctr: number | null;
  rows: { video_id: string; title: string; impressions: number; ctr: number | null }[];
};

export type Report = {
  week: { start: string; end: string };
  previous_week: { start: string; end: string };
  data_through: string;
  complete: boolean;
  kpis: Kpi[];
  daily: { day: string; date: string; current: number | null; previous: number | null }[];
  traffic: TrafficRow[];
  videos: VideoWeek[];
  median_week_views: number;
  launches: Launch[];
  search_terms: { term: string; views: number; previous: number | null; is_new: boolean }[];
  reach: Reach | null;
  insights: string[];
  summary: string | null;
};

export type Status = {
  configured: boolean;
  connected: boolean;
  demo: boolean;
  channel: { id: string; title: string; thumbnail: string | null; subscribers: number; views: number; video_count: number } | null;
  videos: number;
  data_range: { from: string; to: string } | null;
  last_sync: { started_at: string; finished_at: string | null; status: string; detail: string | null } | null;
  syncing: boolean;
  next_sync: string | null;
  llm: { provider: string; enabled: boolean };
};

export type VideoRow = {
  id: string;
  title: string;
  published_at: string;
  duration_s: number;
  thumbnail: string | null;
  views: number;
  likes: number;
  comments: number;
  last7: number;
  prev7: number;
  delta_pct: number | null;
  ctr: number | null;
  impressions: number | null;
};

export type VideoDetail = {
  video: VideoRow;
  daily: { date: string; views: number; subs: number }[];
  retention: { ratio: number; watch_ratio: number; relative_perf: number }[];
  reach: { period_start: string; period_end: string; impressions: number; ctr: number | null }[];
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).detail ?? msg;
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  status: () => req<Status>("/status"),
  weeks: () => req<string[]>("/weeks"),
  report: (week?: string) => req<Report>(`/report${week ? `?week=${week}` : ""}`),
  summarize: (week: string) =>
    req<{ summary: string }>(`/report/summary?week=${week}`, { method: "POST" }),
  videos: () => req<VideoRow[]>("/videos"),
  video: (id: string) => req<VideoDetail>(`/videos/${id}`),
  retention: (id: string) => req<{ points: number }>(`/videos/${id}/retention`, { method: "POST" }),
  sync: () => req<{ started: boolean; reason?: string }>("/sync", { method: "POST" }),
  disconnect: () => req<{ ok: boolean }>("/auth/disconnect", { method: "POST" }),
  importReach: (file: File, start: string, end: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("period_start", start);
    fd.append("period_end", end);
    return req<{ imported: number }>("/reach/import", { method: "POST", body: fd });
  },
};
