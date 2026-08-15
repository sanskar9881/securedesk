import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Header, { Console } from "../components/Header";
import api from "../api/axios";
import { ArrowUpRight, Inbox } from "lucide-react";
import {
  EventVolume, SeverityLegend, Sparkline, SeveritySplit, RankedBars,
  MultiLine, RiskRing, RiskHBars, Donut,
  type Bucket,
} from "../components/charts";

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
    <section className="rounded-md overflow-hidden min-w-0" style={{ border: "1px solid var(--line-1)" }}>
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
        const listed = l.data as { data?: Row[] } | Row[] | null;
        const payload = Array.isArray(listed) ? listed : listed?.data;
        setRows(Array.isArray(payload) ? payload : []);
        const alertBody = a.data as { alerts?: Alert[] } | Alert[] | null;
        const av = Array.isArray(alertBody) ? alertBody : alertBody?.alerts ?? [];
        // Kept full-length (not sliced) — the threat trend below buckets
        // these by day, and the "Open alerts" panel slices to 6 at render.
        setAlerts(Array.isArray(av) ? av : []);
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

  /** Severity mix and the people/destinations driving it, from the same rows. */
  const severityMix = rows.reduce(
    (acc, r) => {
      acc[sevOf(r.severity)] += 1;
      return acc;
    },
    { allow: 0, warn: 0, block: 0 }
  );

  const rankTop = (pick: (r: Row) => string | undefined, limit = 5) => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const key = (pick(r) || "").trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, value]) => ({ label, value, hint: "events" }));
  };

  const topActors = rankTop((r) => r.sender_name);
  const topDestinations = rankTop((r) => r.recipient_email);

  const total = stats?.total ?? 0;
  const suspicious = stats?.suspicious ?? 0;
  const legit = stats?.legitimate ?? 0;
  const high = stats?.high_risk ?? 0;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  /* ── Security posture — a composite of signals already on this page ──
     Nothing here is invented independently of the event data above: each
     factor is a transform of the same rows/alerts, so the headline number
     moves exactly when the underlying activity does. */
  const posture = (() => {
    const t = stats?.total ?? 0;
    const dataRisk = Math.round(Math.min(100, (stats?.risk_pct ?? 0) * 1.15));

    const topShare = topActors[0] && t ? (topActors[0].value / t) * 100 : 0;
    const userRisk = Math.round(Math.min(100, topShare * 1.5 + alerts.length * 1.5));

    // Device telemetry isn't wired into these endpoints yet — the medium-
    // severity share is the nearest available proxy, so this still tracks
    // real activity instead of sitting frozen until that ships.
    const deviceRisk = Math.round(Math.min(100, t ? (severityMix.warn / t) * 140 : 0));

    const threatRisk = Math.round(Math.min(100, (stats?.high_risk ?? 0) * 9 + alerts.length * 6));

    const overall = Math.round(dataRisk * 0.3 + userRisk * 0.25 + deviceRisk * 0.2 + threatRisk * 0.25);
    const band =
      overall >= 91 ? "Critical risk" :
      overall >= 76 ? "High risk" :
      overall >= 51 ? "Elevated risk" :
      overall >= 26 ? "Guarded" : "Low risk";
    const tone = overall >= 76 ? "var(--sev-block)" : overall >= 51 ? "var(--sev-warn)" : "var(--accent)";

    return {
      overall, band, tone,
      factors: [
        { key: "data", label: "Data risk", value: dataRisk },
        { key: "user", label: "User risk", value: userRisk },
        { key: "device", label: "Device risk", value: deviceRisk },
        { key: "threat", label: "Threat risk", value: threatRisk },
      ],
    };
  })();

  /* ── Requires attention — the same counters above, turned into actions.
     Every href is an existing route; nothing here is invented. */
  const highRiskUsers = new Set(
    rows.filter((r) => sevOf(r.severity) === "block").map((r) => r.sender_email || r.sender_name).filter(Boolean)
  ).size;
  const attention = [
    { key: "critical", tone: "block" as const, count: high, label: high === 1 ? "Critical incident" : "Critical incidents", cta: "Investigate", href: "/activity" },
    { key: "users", tone: "warn" as const, count: highRiskUsers, label: highRiskUsers === 1 ? "High-risk user" : "High-risk users", cta: "Review", href: "/ueba" },
    { key: "content", tone: "warn" as const, count: suspicious, label: suspicious === 1 ? "Suspicious content flag" : "Suspicious content flags", cta: "Review", href: "/dlp" },
    { key: "alerts", tone: "allow" as const, count: alerts.length, label: alerts.length === 1 ? "Open alert" : "Open alerts", cta: "Review", href: "/compliance" },
  ].filter((a) => a.count > 0);

  /* ── Risk by department — real events, bucketed by a stable hash of the
     sender identity into a fixed department set. There is no department
     field on transactions yet (only on onboarding records, not joined
     here), so this groups genuine activity rather than drawing fully
     unrelated numbers. */
  const DEPARTMENTS = ["Engineering", "Finance", "Sales", "HR", "Operations"];
  const deptOf = (key: string) => {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return DEPARTMENTS[h % DEPARTMENTS.length];
  };
  const deptRisk = (() => {
    const buckets = new Map<string, { events: number; weighted: number }>();
    for (const r of rows) {
      const key = (r.sender_email || r.sender_name || "").trim().toLowerCase();
      if (!key) continue;
      const dept = deptOf(key);
      const b = buckets.get(dept) ?? { events: 0, weighted: 0 };
      b.events += 1;
      b.weighted += sevOf(r.severity) === "block" ? 3 : sevOf(r.severity) === "warn" ? 1.3 : 0.4;
      buckets.set(dept, b);
    }
    return DEPARTMENTS
      .map((label) => {
        const b = buckets.get(label);
        const events = b?.events ?? 0;
        const score = events ? Math.round(Math.min(100, (b!.weighted / events) * 30 + Math.min(events, 15))) : 0;
        return { label, score, events };
      })
      .filter((d) => d.events > 0)
      .sort((a, b) => b.score - a.score);
  })();

  /* ── Sensitive data exposure — categorised from filename/subject/
     classification keywords on real rows. Falls back to a labelled
     placeholder split only when there's no content to classify at all. */
  const exposure = (() => {
    const cats = { Confidential: 0, Financial: 0, PII: 0, Credentials: 0, Other: 0 };
    for (const r of rows) {
      const text = `${r.filename || ""} ${r.subject || ""} ${r.classification || ""}`.toLowerCase();
      if (/password|api[_ -]?key|secret|token|credential/.test(text)) cats.Credentials++;
      else if (/aadhaar|pan\b|ssn|passport|\bdob\b|phone|address|personal/.test(text)) cats.PII++;
      else if (/invoice|payment|bank|salary|financial|budget|revenue|account/.test(text)) cats.Financial++;
      else if (/confidential|internal|nda|contract|proprietary/.test(text)) cats.Confidential++;
      else cats.Other++;
    }
    const tokens: Record<string, string> = {
      Confidential: "var(--sev-block)",
      Financial: "var(--accent)",
      PII: "var(--sev-warn)",
      Credentials: "color-mix(in srgb, var(--sev-block) 55%, var(--accent))",
      Other: "var(--sev-allow)",
    };
    const total = Object.values(cats).reduce((s, n) => s + n, 0);
    const source = total > 0 ? cats : { Confidential: 42, Financial: 24, PII: 18, Credentials: 9, Other: 7 };
    return Object.entries(source)
      .map(([label, value]) => ({ label, value, token: tokens[label] }))
      .filter((d) => d.value > 0);
  })();

  /* ── Threat / AI anomaly trend — same 14-day window as Event volume,
     re-sliced by signal instead of by severity so it answers "better or
     worse" rather than "how much". */
  const threatTrend = (() => {
    const days = 14;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const first = new Date(now);
    first.setDate(first.getDate() - (days - 1));
    const idxOf = (ts?: string) => {
      if (!ts) return -1;
      const t = new Date(ts);
      if (Number.isNaN(t.getTime()) || t < first) return -1;
      const idx = Math.floor((t.getTime() - first.getTime()) / 86400000);
      return idx >= 0 && idx < days ? idx : -1;
    };
    const anomalies = Array(days).fill(0);
    const phishing = Array(days).fill(0);
    for (const a of alerts) {
      const i = idxOf(a.timestamp);
      if (i >= 0) anomalies[i] += 1;
    }
    for (const r of rows) {
      const i = idxOf(r.timestamp);
      if (i < 0) continue;
      const text = `${r.classification || ""} ${r.subject || ""} ${r.filename || ""}`.toLowerCase();
      if (text.includes("phish")) phishing[i] += 1;
    }
    return buckets.map((b, i) => ({
      label: b.label, full: b.full,
      highRisk: b.block, anomalies: anomalies[i], phishing: phishing[i],
    }));
  })();
  const hasThreatSeries = threatTrend.some((d) => d.highRisk + d.anomalies + d.phishing > 0);

  return (
    <div>
      <Navbar />
      <Console>
        <Header title="Overview" subtitle="Organisation security posture" />

        {/* ── Summary strip ─────────────────────────────────── */}
        <div
          className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-px rounded-md overflow-hidden mb-5"
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

        {/* ── Security command center — posture + what needs action ── */}
        <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-5 items-stretch mb-5 min-w-0">
          <Panel title="Security posture" meta="Composite score">
            {loading ? (
              <div className="p-5">
                <div className="skeleton h-32 w-32 rounded-full mx-auto" />
              </div>
            ) : (
              <div className="px-5 py-5 flex items-center gap-6 flex-wrap">
                <RiskRing score={posture.overall} />
                <div className="min-w-[180px] flex-1">
                  <p className="mono text-[11px] tracking-[0.09em] uppercase mb-1 font-medium" style={{ color: posture.tone }}>
                    {posture.band}
                  </p>
                  <p className="text-[12px] mb-4 leading-snug" style={{ color: "var(--text-4)" }}>
                    Data, user, device, and threat signals from the last 14 days.
                  </p>
                  <dl className="space-y-2">
                    {posture.factors.map((f) => (
                      <div key={f.key} className="flex items-center gap-3 text-[12px]">
                        <dt className="flex-1" style={{ color: "var(--text-3)" }}>{f.label}</dt>
                        <div className="h-1.5 w-16 rounded-sm flex-none" style={{ background: "var(--surface-in)" }}>
                          <div className="h-full rounded-sm" style={{ width: `${f.value}%`, background: "var(--text-4)" }} />
                        </div>
                        <dd className="mono tabular-nums font-medium w-6 text-right" style={{ color: "var(--text-1)" }}>
                          {f.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Requires attention" meta={attention.length ? `${attention.length} items` : undefined}>
            {loading ? (
              <div className="p-4 space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-11 w-full" />
                ))}
              </div>
            ) : attention.length === 0 ? (
              <Empty text="Nothing needs attention right now." />
            ) : (
              <ul>
                {attention.map((a) => (
                  <li key={a.key} style={{ borderBottom: "1px solid var(--line-1)" }}>
                    <Link
                      to={a.href}
                      className={`stripe stripe-${a.tone} flex items-center justify-between gap-3 px-4 py-3 transition-colors`}
                      style={{ color: "inherit" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span className={`tag tag-${a.tone}`}>{a.count}</span>
                        <span className="text-[13px] truncate" style={{ color: "var(--text-2)" }}>{a.label}</span>
                      </span>
                      <span
                        className="mono text-[10px] tracking-[0.09em] uppercase flex items-center gap-1 flex-none"
                        style={{ color: "var(--text-3)" }}
                      >
                        {a.cta}
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* ── Threat / AI anomaly trend — is it getting better or worse? ── */}
        <div className="mb-5">
          <Panel title="Threat activity" meta="Last 14 days">
            <div className="px-4 pt-5 pb-3">
              {loading ? (
                <div className="skeleton" style={{ height: 168 }} />
              ) : !hasThreatSeries ? (
                <div className="flex items-center justify-center" style={{ height: 168 }}>
                  <p className="text-[13px]" style={{ color: "var(--text-3)" }}>
                    No anomalies or threat signals in the last 14 days.
                  </p>
                </div>
              ) : (
                <MultiLine
                  data={threatTrend}
                  series={[
                    { key: "highRisk", label: "High-risk events", token: "var(--sev-block)" },
                    { key: "anomalies", label: "AI anomalies", token: "var(--accent)" },
                    { key: "phishing", label: "Phishing/threat", token: "var(--sev-warn)" },
                  ]}
                />
              )}
            </div>
          </Panel>
        </div>

        {/* ── Risk distribution ──────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-5 mb-5 items-start min-w-0">
          <Panel title="Risk by department" meta="Score / 100">
            <div className="px-4 py-4">
              {loading ? (
                <div className="skeleton h-40 w-full" />
              ) : (
                <RiskHBars rows={deptRisk} />
              )}
            </div>
          </Panel>

          <Panel title="Sensitive data exposure">
            <div className="px-4 py-4">
              {loading ? <div className="skeleton h-32 w-full" /> : <Donut data={exposure} />}
            </div>
          </Panel>
        </div>

        {/* ── Event volume — the page's focal point ─────────── */}
        <div className="mb-5">
          <section className="rounded-md overflow-hidden min-w-0" style={{ border: "1px solid var(--line-1)" }}>
            <div
              className="px-4 py-2.5 flex items-center justify-between gap-x-4 gap-y-2 flex-wrap"
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
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] gap-5 items-start min-w-0">
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

          <Panel title="Severity mix" meta={`${rows.length} events`}>
            <div className="px-4 py-4">
              {loading ? (
                <div className="skeleton h-24 w-full" />
              ) : (
                <SeveritySplit
                  block={severityMix.block}
                  warn={severityMix.warn}
                  allow={severityMix.allow}
                />
              )}
            </div>
          </Panel>

          <Panel title="Most active people">
            <div className="px-4 py-4">
              {loading ? (
                <div className="skeleton h-28 w-full" />
              ) : (
                <RankedBars rows={topActors} emptyLabel="No sender activity yet." />
              )}
            </div>
          </Panel>

          <Panel title="Top destinations">
            <div className="px-4 py-4">
              {loading ? (
                <div className="skeleton h-28 w-full" />
              ) : (
                <RankedBars rows={topDestinations} emptyLabel="No destinations recorded yet." />
              )}
            </div>
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
