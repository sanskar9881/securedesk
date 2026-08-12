import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Header, { Console } from "../components/Header";
import api from "../api/axios";
import { ArrowUpRight, Inbox } from "lucide-react";
import { EventVolume, SeverityLegend, Sparkline, type Bucket } from "../components/charts";

/* ── API shapes (bound to what the backend actually returns) ───── */
interface Stats {
  total: number;
  suspicious: number;
  legitimate: number;
  high_risk: number;
  recent_7_days: number;
  total_users: number;
  risk_pct: number;
}
interface Row {
  _id: string;
  sender_name?: string;
  sender_email?: string;
  recipient_email?: string;
  subject?: string;
  filename?: string;
  classification?: string;
  risk_score?: number;
  severity?: string;
  timestamp?: string;
}
interface Alert {
  _id: string;
  message?: string;
  detail?: string;
  severity?: string;
  timestamp?: string;
  user_name?: string;
}

/* ── Primitives ───────────────────────────────────────────────── */

function Metric({
  label,
  value,
  note,
  tone = "neutral",
  loading,
  spark,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  tone?: "neutral" | "block" | "warn" | "allow";
  loading?: boolean;
  spark?: number[];
}) {
  const color =
    tone === "block" ? "var(--sev-block)"
    : tone === "warn" ? "var(--sev-warn)"
    : tone === "allow" ? "var(--sev-allow)"
    : "var(--text-1)";

  return (
    <div className="px-5 py-3.5" style={{ background: "var(--surface-1)" }}>
      <p className="eyebrow mb-2">{label}</p>
      {loading ? (
        <div className="skeleton h-7 w-20" />
      ) : (
        <div className="flex items-end justify-between gap-3">
          <p
            className="text-[26px] leading-none font-semibold tracking-[-0.03em] tabular-nums"
            style={{ color }}
          >
            {value}
          </p>
          {spark && spark.some((n) => n > 0) && (
            <Sparkline values={spark} tone={tone === "neutral" ? "var(--accent)" : color} />
          )}
        </div>
      )}
      {note && !loading && (
        <p className="text-[11.5px] mt-1.5" style={{ color: "var(--text-4)" }}>
          {note}
        </p>
      )}
    </div>
  );
}

const sevOf = (s?: string): "block" | "warn" | "allow" => {
  const v = (s || "").toLowerCase();
  if (v === "high" || v === "critical") return "block";
  if (v === "medium") return "warn";
  return "allow";
};

const sevLabel = (s?: string) => (s || "low").toUpperCase();

function when(ts?: string) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function Panel({
  title,
  meta,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  meta?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md overflow-hidden" style={{ border: "1px solid var(--line-1)" }}>
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-3"
        style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line-1)" }}
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>
            {title}
          </h2>
          {meta && (
            <span className="mono text-[10px] tracking-[0.09em] uppercase" style={{ color: "var(--text-4)" }}>
              {meta}
            </span>
          )}
        </div>
        {href && (
          <Link
            to={href}
            className="mono text-[10px] tracking-[0.09em] uppercase flex items-center gap-1 flex-none transition-colors"
            style={{ color: "var(--text-3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
          >
            {hrefLabel || "View all"}
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div style={{ background: "var(--surface-1)" }}>{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <Inbox className="w-5 h-5 mb-3" style={{ color: "var(--text-4)" }} />
      <p className="text-[13px]" style={{ color: "var(--text-3)" }}>
        {text}
      </p>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/admin/stats").catch(() => ({ data: null })),
      // Pull a wider window than the table shows so the volume chart has
      // something real to bucket. The API exposes no time-series endpoint,
      // so the daily series is derived client-side from actual events.
      api.get("/admin/logs", { params: { limit: 100 } }).catch(() => ({ data: { data: [] } })),
      api.get("/dlp/alerts").catch(() => ({ data: [] })),
    ])
      .then(([s, l, a]) => {
        if (s.data) setStats(s.data as Stats);
        const payload = (l.data as any)?.data ?? l.data;
        setRows(Array.isArray(payload) ? payload : []);
        const av = Array.isArray(a.data) ? a.data : (a.data as any)?.alerts ?? [];
        setAlerts(Array.isArray(av) ? av.slice(0, 6) : []);
      })
      .finally(() => setLoading(false));
  }, []);

  /** Bucket real events into the last 14 days by severity. */
  const buckets: Bucket[] = (() => {
    const days = 14;
    const out: Bucket[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      out.push({
        label: String(d.getDate()),
        full: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        allow: 0, warn: 0, block: 0,
      });
    }
    const first = new Date(now);
    first.setDate(first.getDate() - (days - 1));
    for (const r of rows) {
      if (!r.timestamp) continue;
      const t = new Date(r.timestamp);
      if (Number.isNaN(t.getTime()) || t < first) continue;
      const idx = Math.floor((t.getTime() - first.getTime()) / 86400000);
      if (idx < 0 || idx >= days) continue;
      out[idx][sevOf(r.severity)] += 1;
    }
    return out;
  })();

  const dailyTotals = buckets.map((b) => b.allow + b.warn + b.block);
  const hasSeries = dailyTotals.some((n) => n > 0);

  const total = stats?.total ?? 0;
  const suspicious = stats?.suspicious ?? 0;
  const legit = stats?.legitimate ?? 0;
  const high = stats?.high_risk ?? 0;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div>
      <Navbar />
      <Console>
        <Header title="Overview" subtitle="Organisation security posture" />

        {/* ── Summary strip ─────────────────────────────────── */}
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-md overflow-hidden mb-5"
          style={{ background: "var(--line-1)", border: "1px solid var(--line-1)" }}
        >
          <Metric
            label="Protected people"
            value={stats?.total_users ?? 0}
            note="Accounts in this workspace"
            loading={loading}
          />
          <Metric
            label="Events inspected"
            value={total.toLocaleString()}
            note={`${stats?.recent_7_days ?? 0} in the last 7 days`}
            loading={loading}
            spark={dailyTotals}
          />
          <Metric
            label="High risk"
            value={high}
            tone={high > 0 ? "block" : "neutral"}
            note={high > 0 ? "Needs review" : "Nothing outstanding"}
            loading={loading}
            spark={buckets.map((b) => b.block)}
          />
          <Metric
            label="Risk rate"
            value={`${stats?.risk_pct ?? 0}%`}
            tone={(stats?.risk_pct ?? 0) >= 25 ? "warn" : "neutral"}
            note="Flagged as a share of all events"
            loading={loading}
          />
        </div>

        {/* ── Event volume — the page's focal point ─────────── */}
        <div className="mb-5">
          <section className="rounded-md overflow-hidden" style={{ border: "1px solid var(--line-1)" }}>
            <div
              className="px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap"
              style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line-1)" }}
            >
              <div className="flex items-baseline gap-3">
                <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>
                  Event volume
                </h2>
                <span className="mono text-[10px] tracking-[0.09em] uppercase" style={{ color: "var(--text-4)" }}>
                  Last 14 days
                </span>
              </div>
              <SeverityLegend />
            </div>

            <div className="px-4 pt-5 pb-3" style={{ background: "var(--surface-1)" }}>
              {loading ? (
                <div className="skeleton" style={{ height: 168 }} />
              ) : !hasSeries ? (
                <div className="flex flex-col items-center justify-center text-center" style={{ height: 168 }}>
                  <p className="text-[13px] mb-1" style={{ color: "var(--text-2)" }}>
                    No events in the last 14 days
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--text-4)" }}>
                    {total > 0
                      ? `${total.toLocaleString()} recorded earlier — the chart covers a rolling two-week window.`
                      : "Once the extension is deployed, activity appears here."}
                  </p>
                </div>
              ) : (
                <EventVolume data={buckets} />
              )}
            </div>

            {/* Classification split, demoted to a summary strip under the chart */}
            {!loading && total > 0 && (
              <div
                className="px-4 py-2.5 flex items-center gap-6 flex-wrap"
                style={{ background: "var(--surface-2)", borderTop: "1px solid var(--line-1)" }}
              >
                {[
                  { k: "Legitimate", v: legit },
                  { k: "Suspicious", v: suspicious },
                  { k: "High severity", v: high },
                ].map((s) => (
                  <span key={s.k} className="flex items-baseline gap-2">
                    <span className="mono text-[10px] tracking-[0.09em] uppercase" style={{ color: "var(--text-4)" }}>
                      {s.k}
                    </span>
                    <span className="mono text-[13px] tabular-nums font-medium" style={{ color: "var(--text-1)" }}>
                      {s.v.toLocaleString()}
                    </span>
                    <span className="mono text-[11px] tabular-nums" style={{ color: "var(--text-4)" }}>
                      {pct(s.v).toFixed(0)}%
                    </span>
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Event stream + alerts ─────────────────────────── */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] gap-5 items-start">
          <Panel title="Recent events" meta="Newest first" href="/activity" hrefLabel="Event stream">
            {loading ? (
              <div className="p-4 space-y-2.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-9 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <Empty text="No events yet. They'll appear here as soon as activity is inspected." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line-1)" }}>
                      {["Severity", "Actor", "Destination", "Detail", "Risk", "When"].map((h) => (
                        <th
                          key={h}
                          className="eyebrow px-4 py-2 font-medium whitespace-nowrap"
                          style={{ fontSize: "0.5625rem" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((r) => {
                      const tone = sevOf(r.severity);
                      return (
                        <tr
                          key={r._id}
                          className={`stripe stripe-${tone} transition-colors`}
                          style={{ borderBottom: "1px solid var(--line-1)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className={`tag tag-${tone}`}>{sevLabel(r.severity)}</span>
                          </td>
                          <td className="px-4 py-2.5 text-[13px] max-w-[150px] truncate" style={{ color: "var(--text-1)" }}>
                            {r.sender_name || r.sender_email || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-[13px] max-w-[170px] truncate" style={{ color: "var(--text-2)" }}>
                            {r.recipient_email || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-[13px] max-w-[200px] truncate" style={{ color: "var(--text-3)" }}>
                            {r.filename || r.subject || r.classification || "—"}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span
                              className="mono text-[12px] tabular-nums"
                              style={{
                                color:
                                  (r.risk_score ?? 0) >= 70
                                    ? "var(--sev-block)"
                                    : (r.risk_score ?? 0) >= 35
                                    ? "var(--sev-warn)"
                                    : "var(--text-3)",
                              }}
                            >
                              {r.risk_score != null ? `${r.risk_score}` : "—"}
                            </span>
                          </td>
                          <td
                            className="px-4 py-2.5 mono text-[11.5px] whitespace-nowrap"
                            style={{ color: "var(--text-4)" }}
                          >
                            {when(r.timestamp)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Open alerts" meta={alerts.length ? `${alerts.length}` : undefined}>
            {loading ? (
              <div className="p-4 space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-12 w-full" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <Empty text="No open alerts." />
            ) : (
              <ul>
                {alerts.map((a) => {
                  const tone = sevOf(a.severity);
                  return (
                    <li
                      key={a._id}
                      className={`stripe stripe-${tone} px-4 py-3`}
                      style={{ borderBottom: "1px solid var(--line-1)" }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className={`tag tag-${tone}`}>{sevLabel(a.severity)}</span>
                        <span className="mono text-[10.5px] flex-none" style={{ color: "var(--text-4)" }}>
                          {when(a.timestamp)}
                        </span>
                      </div>
                      <p className="text-[12.5px] leading-snug" style={{ color: "var(--text-2)" }}>
                        {a.detail || a.message || "Anomaly detected"}
                      </p>
                      {a.user_name && (
                        <p className="mono text-[10px] tracking-[0.08em] uppercase mt-1" style={{ color: "var(--text-4)" }}>
                          {a.user_name}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </Console>
    </div>
  );
}
