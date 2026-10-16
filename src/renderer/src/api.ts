import type { Locale } from "../../shared/i18n";

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
  flag: "new" | "outlier" | "rising" | "falling" | null;
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

export type AccountView = {
  id: string;
  title: string;
  thumbnail: string | null;
  subscribers: number;
  connected: boolean;
  active: boolean;
  demo: boolean;
};

export type Status = {
  configured: boolean;
  connected: boolean;
  demo: boolean;
  accounts: AccountView[];
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

export type McpView = {
  enabled: boolean;
  port: number;
  running: boolean;
  url: string | null;
  tokenHint: string | null;
};

export type SettingsView = {
  tz: string;
  syncHour: number;
  syncDaysBack: number;
  initialDaysBack: number;
  llmProvider: "none" | "anthropic" | "openai" | "compatible";
  llmModel: string;
  llmBaseUrl: string;
  enabled: boolean;
  keySet: boolean;
  keyHint: string | null;
};

export const api = {
  locale: () => window.kliq.locale(),
  setLocale: (locale: Locale) => window.kliq.setLocale(locale),
  status: () => window.kliq.status(),
  weeks: () => window.kliq.weeks(),
  report: (week?: string) => window.kliq.report(week),
  seedDemo: () => window.kliq.seedDemo(),
  summarize: (week: string) => window.kliq.summarize(week),
  videos: () => window.kliq.videos(),
  video: (id: string) => window.kliq.video(id),
  retention: (id: string) => window.kliq.retention(id),
  sync: () => window.kliq.sync(),
  accounts: () => window.kliq.accounts() as Promise<AccountView[]>,
  activateAccount: (id: string) => window.kliq.activateAccount(id) as Promise<{ ok: boolean }>,
  disconnect: (id: string) => window.kliq.disconnect(id) as Promise<{ ok: boolean }>,
  client: () => window.kliq.client() as Promise<{ clientId: string; secretHint: string | null }>,
  saveClient: (clientId: string, clientSecret: string) =>
    window.kliq.saveClient({ clientId, clientSecret }) as Promise<{ clientId: string; secretHint: string | null }>,
  connect: () => window.kliq.connect() as Promise<{ ok: boolean }>,
  onAuth: (cb: (result: { ok: boolean; message?: string }) => void) => window.kliq.onAuth(cb),
  importReach: async (file: File, start: string, end: string) =>
    window.kliq.importReach({ csv: await file.text(), periodStart: start, periodEnd: end }),
  settings: () => window.kliq.settings() as Promise<SettingsView>,
  saveSettings: (payload: Omit<SettingsView, "enabled" | "keySet" | "keyHint">) =>
    window.kliq.saveSettings(payload) as Promise<SettingsView>,
  saveLlmKey: (key: string) => window.kliq.saveLlmKey(key) as Promise<{ keySet: boolean; keyHint: string | null }>,
  clearLlmKey: () => window.kliq.clearLlmKey() as Promise<{ keySet: boolean; keyHint: string | null }>,
  mcp: () => window.kliq.mcp() as Promise<McpView>,
  saveMcp: (payload: { enabled: boolean; port: number }) =>
    window.kliq.saveMcp(payload) as Promise<{ view: McpView; token?: string }>,
  rotateMcp: () => window.kliq.rotateMcp() as Promise<{ token: string; view: McpView }>,
  copyMcp: () => window.kliq.copyMcp() as Promise<{ copied: boolean }>,
};
