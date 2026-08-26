import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Header, { Console } from "../components/Header";
import Panel, { PanelEmpty, StatCard } from "../components/Panel";
import api from "../api/axios";
import { ShieldCheck, ShieldAlert, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

interface EvidenceEntry {
  _id: string;
  user_id: string;
  seq: number;
  event_type: string;
  timestamp: string;
  payload: {
    filename?: string;
    risk_level?: string;
    action?: string;
    file_hash?: string;
    reason?: string;
    [k: string]: unknown;
  };
}
interface FeedResponse {
  total: number;
  page: number;
  limit: number;
  data: EvidenceEntry[];
}
interface VerifyResponse {
  chain_intact: boolean;
  head_signature_valid: boolean | null;
  entries_verified: number;
  expected_entries: number;
  last_checkpoint_at: string | null;
  last_checkpoint_seq: number | null;
  problems: { seq?: number; issue?: string; [k: string]: unknown }[];
  verdict: string;
}
interface StatsResponse {
  chain_length: number;
  counts_by_event_type: Record<string, number>;
  blocked_count: number;
  logging_since: string | null;
}
interface OrgUser {
  _id: string;
  name: string;
}

const PAGE_SIZE = 25;

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

const riskTag = (r?: string) => {
  const v = (r || "").toUpperCase();
  if (v === "HIGH") return "tag-block";
  if (v === "MEDIUM") return "tag-warn";
  if (v === "LOW") return "tag-allow";
  return "tag-quiet";
};
const decisionTag = (a?: string) => {
  const v = (a || "").toUpperCase();
  if (v === "BLOCK") return "tag-block";
  if (v === "WARN") return "tag-warn";
  if (v === "ALLOW") return "tag-allow";
  return "tag-quiet";
};

export default function EvidencePage() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [verify, setVerify] = useState<VerifyResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const [page, setPage] = useState(1);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const userName = (id: string) => users.find((u) => u._id === id)?.name || id.slice(0, 8);

  const loadFeed = () => {
    setLoading(true);
    const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
    if (eventTypeFilter) params.event_type = eventTypeFilter;
    if (start) params.start = new Date(start).toISOString();
    if (end) params.end = new Date(end).toISOString();
    api
      .get("/evidence/feed", { params })
      .then(({ data }) => setFeed(data))
      .catch(() => setFeed(null))
      .finally(() => setLoading(false));
  };

  const loadVerify = () => {
    setVerifying(true);
    api
      .get("/evidence/verify")
      .then(({ data }) => setVerify(data))
      .catch(() => setVerify(null))
      .finally(() => setVerifying(false));
  };

  useEffect(() => {
    loadVerify();
    api.get("/evidence/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/evidence/event-types").then(({ data }) => setEventTypes(data.event_types || [])).catch(() => {});
    api.get("/admin/users").then(({ data }) => setUsers(data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, eventTypeFilter, start, end]);

  const totalPages = feed ? Math.max(1, Math.ceil(feed.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex">
      <Navbar />
      <Console>
        <Header
          title="Evidence"
          subtitle="DPDP-compliant, hash-chained audit trail"
          actions={
            <button onClick={loadVerify} disabled={verifying} className="btn btn-secondary !py-2 !px-3.5 text-[13px]">
              {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Re-verify chain
            </button>
          }
        />

        {/* Chain integrity banner — the whole reason this page exists */}
        <div
          className="mb-6 rounded-md p-4 flex items-start gap-3"
          style={{
            background: !verify
              ? "var(--surface-1)"
              : verify.chain_intact
              ? "var(--sev-allow-wash)"
              : "var(--sev-block-wash)",
            border: `1px solid ${!verify ? "var(--line-1)" : verify.chain_intact ? "var(--sev-allow)" : "var(--sev-block)"}`,
          }}
        >
          {!verify ? (
            <Loader2 className="w-5 h-5 animate-spin flex-none mt-0.5" style={{ color: "var(--text-3)" }} />
          ) : verify.chain_intact ? (
            <ShieldCheck className="w-5 h-5 flex-none mt-0.5" style={{ color: "var(--sev-allow)" }} />
          ) : (
            <ShieldAlert className="w-5 h-5 flex-none mt-0.5" style={{ color: "var(--sev-block)" }} />
          )}
          <div className="min-w-0 flex-1">
            <p
              className="text-[14px] font-bold tracking-[-0.01em]"
              style={{ color: !verify ? "var(--text-2)" : verify.chain_intact ? "var(--sev-allow)" : "var(--sev-block)" }}
            >
              {!verify ? "Checking chain integrity…" : verify.chain_intact ? "Chain intact ✓" : "INTEGRITY FAILURE"}
            </p>
            {verify && (
              <>
                <p className="text-[12.5px] mt-1" style={{ color: "var(--text-3)" }}>
                  {verify.verdict}
                </p>
                {verify.problems.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {verify.problems.map((p, i) => (
                      <li key={i} className="text-[11.5px] mono" style={{ color: "var(--sev-block)" }}>
                        {p.seq !== undefined ? `seq ${p.seq}: ` : ""}
                        {p.issue || JSON.stringify(p)}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mono text-[10.5px] tracking-[0.06em] uppercase mt-2" style={{ color: "var(--text-4)" }}>
                  {verify.entries_verified} / {verify.expected_entries} entries verified
                  {verify.last_checkpoint_seq != null && ` · last checkpoint at seq ${verify.last_checkpoint_seq}`}
                </p>
              </>
            )}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Chain length" value={stats.chain_length} />
            <StatCard label="Blocked events" value={stats.blocked_count} tone={stats.blocked_count > 0 ? "block" : "neutral"} />
            <StatCard label="Event types seen" value={Object.keys(stats.counts_by_event_type).length} />
            <StatCard label="Logging since" value={stats.logging_since ? fmtDate(stats.logging_since).split(" ")[0] : "—"} />
          </div>
        )}

        <Panel
          title="Evidence feed"
          meta={feed ? `${feed.total} entries` : undefined}
          actions={
            <div className="flex items-center gap-2">
              <select
                value={eventTypeFilter}
                onChange={(e) => { setPage(1); setEventTypeFilter(e.target.value); }}
                className="text-[12px] rounded px-2 py-1.5"
                style={{ background: "var(--surface-in)", color: "var(--text-2)", border: "1px solid var(--line-2)" }}
              >
                <option value="">All event types</option>
                {eventTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="date"
                value={start}
                onChange={(e) => { setPage(1); setStart(e.target.value); }}
                className="text-[12px] rounded px-2 py-1.5"
                style={{ background: "var(--surface-in)", color: "var(--text-2)", border: "1px solid var(--line-2)" }}
              />
              <input
                type="date"
                value={end}
                onChange={(e) => { setPage(1); setEnd(e.target.value); }}
                className="text-[12px] rounded px-2 py-1.5"
                style={{ background: "var(--surface-in)", color: "var(--text-2)", border: "1px solid var(--line-2)" }}
              />
            </div>
          }
        >
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : !feed || feed.data.length === 0 ? (
            <PanelEmpty text="No evidence entries match this filter." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line-1)" }}>
                      {["Timestamp", "User", "Event", "Filename", "Risk", "Decision"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 eyebrow" style={{ fontSize: "0.625rem" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {feed.data.map((e) => (
                      <tr key={e._id} style={{ borderBottom: "1px solid var(--line-1)" }}>
                        <td className="px-4 py-3 mono text-[11.5px] whitespace-nowrap" style={{ color: "var(--text-4)" }}>
                          {fmtDate(e.timestamp)}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-1)" }}>{userName(e.user_id)}</td>
                        <td className="px-4 py-3 mono text-[11.5px]" style={{ color: "var(--text-3)" }}>{e.event_type}</td>
                        <td className="px-4 py-3 max-w-[220px] truncate" style={{ color: "var(--text-2)" }}>
                          {e.payload?.filename || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {e.payload?.risk_level ? (
                            <span className={`tag ${riskTag(e.payload.risk_level)}`}>{e.payload.risk_level}</span>
                          ) : (
                            <span style={{ color: "var(--text-4)" }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {e.payload?.action ? (
                            <span className={`tag ${decisionTag(e.payload.action)}`}>{e.payload.action}</span>
                          ) : (
                            <span style={{ color: "var(--text-4)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--line-1)" }}>
                <span className="mono text-[11px]" style={{ color: "var(--text-4)" }}>
                  Page {feed.page} of {totalPages}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn btn-ghost !py-1 !px-2"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn btn-ghost !py-1 !px-2"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </Panel>
      </Console>
    </div>
  );
}
