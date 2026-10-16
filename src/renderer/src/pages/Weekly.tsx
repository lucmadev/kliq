import { useEffect, useState } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, type Report, type Status } from "../api";
import { Card, Delta, Empty, Flag, MiniMarkdown } from "../components/ui";
import { day, num, range, secs, short } from "../format";
import { useI18n } from "../i18n";

type Props = { status: Status; onOpenVideo: (id: string) => void };

export default function Weekly({ status, onOpenVideo }: Props) {
  const { t, locale } = useI18n();
  const [weeks, setWeeks] = useState<string[]>([]);
  const [week, setWeek] = useState<string | undefined>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    api.weeks().then((w) => {
      setWeeks(w);
      setWeek((cur) => cur ?? w[0]);
    }).catch((e) => setError(e.message));
  }, [status.data_range?.to]);

  useEffect(() => {
    if (!week) return;
    setError(null);
    api.report(week).then(setReport).catch((e) => setError(e.message));
  }, [week]);

  if (error && !report) return <Empty>{error}</Empty>;
  if (!weeks.length && !report) return <Empty>{t("week.empty")}</Empty>;
  if (!report) return <div className="loading">{t("week.loading")}</div>;

  const idx = weeks.indexOf(report.week.start);
  const summarize = async () => {
    setSummarizing(true);
    try {
      const { summary } = await api.summarize(report.week.start);
      setReport({ ...report, summary });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div className="page">
      <div className="toolbar">
        <div className="week-nav">
          <button className="icon-btn" disabled={idx >= weeks.length - 1}
            onClick={() => setWeek(weeks[idx + 1])} aria-label={t("week.previous")}>‹</button>
          <select value={report.week.start} onChange={(e) => setWeek(e.target.value)}>
            {weeks.map((w, i) => (
              <option key={w} value={w}>
                {i === 0 ? t("week.latest_prefix") : ""}{range(w, addDays(w, 6), locale)}
              </option>
            ))}
          </select>
          <button className="icon-btn" disabled={idx <= 0}
            onClick={() => setWeek(weeks[idx - 1])} aria-label={t("week.next")}>›</button>
        </div>
        <span className="muted small">
          {t("week.vs", {
            range: range(report.previous_week.start, report.previous_week.end, locale),
            through: day(report.data_through, locale),
          })}
        </span>
      </div>

      <div className="kpis">
        {report.kpis.map((k) => (
          <div className="kpi" key={k.key}>
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">{k.unit === "secs" ? secs(k.current) : num(k.current, locale)}</span>
            <span className="kpi-foot">
              <Delta value={k.delta_pct} />
              <span className="muted">{t("col.before").toLowerCase()} {k.unit === "secs" ? secs(k.previous) : num(k.previous, locale)}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <Card title={t("week.what")} className="insights">
          {report.insights.length ? (
            <ul className="insight-list">
              {report.insights.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          ) : <Empty>{t("week.quiet")}</Empty>}
          <div className="ai-block">
            <div className="ai-head">
              <span className="ai-tag">{t("week.ai")}</span>
              {status.llm.enabled ? (
                <button className="btn ghost small" onClick={summarize} disabled={summarizing}>
                  {summarizing ? t("week.thinking") : report.summary ? t("week.regenerate") : t("week.generate")}
                </button>
              ) : (
                <span className="muted small">{t("week.ai_off")}</span>
              )}
            </div>
            {report.summary ? <MiniMarkdown text={report.summary} /> : (
              <p className="muted small">{t("week.ai_pending")}</p>
            )}
          </div>
        </Card>

        <Card title={t("week.views_by_day")} aside={<span className="muted small">{t("week.vs_previous")}</span>}>
          <div className="chart">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={report.daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "var(--text-2)", fontSize: 12 }} />
                <YAxis tickFormatter={(v) => short(Number(v), locale)} tickLine={false} axisLine={false} width={44}
                  tick={{ fill: "var(--text-2)", fontSize: 12 }} />
                <Tooltip
                  cursor={{ stroke: "var(--text-3)", strokeWidth: 1 }}
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}
                  labelStyle={{ color: "var(--text-1)" }}
                  itemStyle={{ color: "var(--text-1)" }}
                  formatter={(v) => num(Number(v), locale)}
                />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--text-2)" }} />
                <Line name={t("week.series_previous")} dataKey="previous" stroke="var(--prev)" strokeWidth={2}
                  strokeDasharray="4 4" dot={false} activeDot={{ r: 4 }} />
                <Line name={t("week.series_current")} dataKey="current" stroke="var(--series-1)" strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: "var(--series-1)" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid-2">
        <Card title={t("week.traffic")}>
          <div className="traffic">
            {report.traffic.filter((row) => row.current || row.previous).map((row) => (
              <div className="traffic-row" key={row.source} title={t("week.traffic_tip", {
                label: row.label,
                current: num(row.current, locale),
                previous: num(row.previous, locale),
              })}>
                <span className="traffic-label">{row.label}</span>
                <span className="bar-track">
                  <span className="bar" style={{ width: `${Math.max(row.share, 0.5)}%` }} />
                </span>
                <span className="num">{num(row.share, locale)}%</span>
                <span className="num">{num(row.current, locale)}</span>
                <Delta value={row.delta_pct} />
              </div>
            ))}
          </div>
        </Card>

        <Card title={t("week.launches")} aside={<span className="muted small">{t("week.launch_aside")}</span>}>
          {report.launches.length ? report.launches.map((l) => (
            <button className="launch" key={l.id} onClick={() => onOpenVideo(l.id)}>
              <span className="launch-title">{l.title}</span>
              <span className="muted small">{t("week.published", {
                date: day(l.published_at, locale),
                days: l.days,
                unit: l.days === 1 ? t("week.day") : t("week.days"),
              })}</span>
              <span className="launch-stats">
                <strong>{num(l.views, locale)}</strong>
                <span className="muted"> {t("week.vs_baseline", { baseline: l.baseline != null ? num(Math.round(l.baseline), locale) : "—" })}</span>
                {l.ratio != null && (
                  <span className={`ratio ${l.ratio >= 1 ? "up" : "down"}`}>{num(l.ratio, locale)}x</span>
                )}
              </span>
            </button>
          )) : <Empty>{t("week.no_launches")}</Empty>}

          <h3 className="sub">{t("week.searches")}</h3>
          {report.search_terms.length ? (
            <div className="chips">
              {report.search_terms.slice(0, 16).map((s) => (
                <span className={`chip ${s.is_new ? "chip-new" : ""}`} key={s.term} title={t("week.search_tip", { count: num(s.views, locale) })}>
                  {s.is_new && <span className="chip-kicker">{t("delta.new")} · </span>}
                  {s.term} <span className="muted">{short(s.views, locale)}</span>
                </span>
              ))}
            </div>
          ) : <Empty>{t("week.no_searches")}</Empty>}
        </Card>
      </div>

      <Card title={t("week.videos")} aside={<span className="muted small">{t("week.median_aside", { count: num(report.median_week_views, locale) })}</span>}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("col.video")}</th>
                <th className="r">{t("col.views")}</th>
                <th className="r">{t("col.before")}</th>
                <th className="r">{t("col.change")}</th>
                <th className="r">{t("col.vs_median")}</th>
                <th className="r">{t("col.hours")}</th>
                <th className="r">{t("col.subs")}</th>
              </tr>
            </thead>
            <tbody>
              {report.videos.map((v) => (
                <tr key={v.id} onClick={() => onOpenVideo(v.id)} className="clickable">
                  <td className="title-cell">
                    <span className="title-text">{v.title}</span> <Flag flag={v.flag} />
                  </td>
                  <td className="r num">{num(v.views, locale)}</td>
                  <td className="r num muted">{num(v.previous, locale)}</td>
                  <td className="r"><Delta value={v.delta_pct} /></td>
                  <td className="r num">{v.ratio_vs_median != null ? `${num(v.ratio_vs_median, locale)}x` : "—"}</td>
                  <td className="r num">{num(v.watch_hours, locale)}</td>
                  <td className="r num">{num(v.subs, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t("week.reach")}
        aside={report.reach ? <span className="muted small">{t("week.reach_aside", {
          range: range(report.reach.period_start, report.reach.period_end, locale),
          ctr: report.reach.median_ctr != null ? num(report.reach.median_ctr, locale) : "—",
        })}</span> : null}>
        {report.reach ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t("col.video")}</th><th className="r">{t("col.impressions")}</th><th className="r">{t("col.ctr")}</th></tr>
              </thead>
              <tbody>
                {report.reach.rows.slice(0, 10).map((r) => {
                  const low = report.reach!.median_ctr != null && r.ctr != null && r.ctr < report.reach!.median_ctr * 0.7 && r.impressions >= 1000;
                  return (
                    <tr key={r.video_id} onClick={() => onOpenVideo(r.video_id)} className="clickable">
                      <td className="title-cell"><span className="title-text">{r.title}</span>
                        {low && <span className="flag flag-falling">{t("flag.low_ctr")}</span>}</td>
                      <td className="r num">{num(r.impressions, locale)}</td>
                      <td className="r num">{r.ctr != null ? `${num(r.ctr, locale)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t("week.no_reach")}</Empty>
        )}
      </Card>
    </div>
  );
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
