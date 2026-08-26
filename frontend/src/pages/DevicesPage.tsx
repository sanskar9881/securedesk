import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Header, { Console } from "../components/Header";
import Panel, { PanelEmpty, StatCard } from "../components/Panel";
import api from "../api/axios";
import { apiErrorMessage } from "../api/errors";
import toast from "react-hot-toast";
import { Copy, Loader2, Plus, Trash2, X } from "lucide-react";

interface DeviceRow {
  device_id: string;
  user_id: string;
  name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  revoked: boolean;
}
interface OrgUser {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // The raw token is only ever visible in this piece of state, right after
  // minting — never re-fetched or persisted. See POST /api/auth/devices.
  const [minted, setMinted] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/admin/devices").catch(() => ({ data: [] as DeviceRow[] })),
      api.get("/admin/users").catch(() => ({ data: [] as OrgUser[] })),
      api.get("/admin/stats").catch(() => ({ data: null })),
    ])
      .then(([d, u, s]) => {
        setDevices(d.data);
        setUsers(u.data);
        setTotalUsers(s.data?.total_users ?? null);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const userName = (id: string) => users.find((u) => u._id === id)?.name || "Unknown employee";

  const activeDevices = devices.filter((d) => !d.revoked);
  const coverageX = new Set(activeDevices.map((d) => d.user_id)).size;
  const coverageY = totalUsers ?? users.length;
  const coveragePct = coverageY > 0 ? Math.round((coverageX / coverageY) * 100) : 0;
  const coverageTone = coveragePct >= 80 ? "allow" : coveragePct >= 40 ? "warn" : "block";

  const generate = async () => {
    setGenerating(true);
    try {
      // Self-service: this mints a token for the CURRENTLY SIGNED-IN
      // account (there is no "generate on another employee's behalf"
      // endpoint — see PATCH .../role for the closest analog to admin-
      // acting-for-another-account, which device tokens deliberately
      // don't have). Each employee generates their own the same way, from
      // wherever they can reach this call — see Settings for the
      // non-admin entry point.
      const { data } = await api.post("/auth/devices", { name: "SecureDesk console device" });
      setMinted(data.device_token);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't generate a device token."));
    } finally {
      setGenerating(false);
    }
  };

  const revoke = async (deviceId: string) => {
    setRevokingId(deviceId);
    try {
      await api.delete(`/admin/devices/${deviceId}`);
      toast.success("Device revoked.");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't revoke that device."));
    } finally {
      setRevokingId(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Couldn't copy — select and copy the token manually.");
    }
  };

  return (
    <div className="flex">
      <Navbar />
      <Console>
        <Header
          title="Devices"
          subtitle="Chrome extension enrollment"
          actions={
            <button
              onClick={generate}
              disabled={generating}
              className="btn btn-primary !py-2 !px-3.5 text-[13px]"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Generate Device Token
            </button>
          }
        />

        {minted && (
          <div
            className="mb-6 rounded-md p-4"
            style={{ background: "var(--sev-allow-wash)", border: "1px solid var(--sev-allow)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold mb-1.5" style={{ color: "var(--text-1)" }}>
                  Device token created — copy it now
                </p>
                <p className="text-[11.5px] mb-2.5" style={{ color: "var(--text-3)" }}>
                  This is shown once and can't be retrieved again. Paste it into the SecureDesk
                  Chrome extension's popup to enrol this device.
                </p>
                <code
                  className="block px-3 py-2 rounded text-[12px] mono break-all"
                  style={{ background: "var(--surface-in)", color: "var(--text-1)", border: "1px solid var(--line-2)" }}
                >
                  {minted}
                </code>
                <button onClick={() => copy(minted)} className="btn btn-secondary !py-1.5 !px-3 text-[12px] mt-3">
                  <Copy className="w-3.5 h-3.5" /> Copy token
                </button>
              </div>
              <button
                onClick={() => setMinted(null)}
                className="flex-none p-1 rounded"
                style={{ color: "var(--text-4)" }}
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Employees protected"
            value={`${coverageX} / ${coverageY}`}
            tone={coverageTone}
            note={`${coveragePct}% coverage`}
          />
          <StatCard label="Active devices" value={activeDevices.length} />
          <StatCard label="Revoked" value={devices.length - activeDevices.length} />
          <StatCard label="Total employees" value={coverageY} />
        </div>

        <Panel title="Enrolled devices" meta={`${devices.length} total`}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : devices.length === 0 ? (
            <PanelEmpty text="No devices enrolled yet. Generate a token above and paste it into the Chrome extension." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line-1)" }}>
                    {["Employee", "Device", "Created", "Last seen", "Status", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 eyebrow" style={{ fontSize: "0.625rem" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.device_id} style={{ borderBottom: "1px solid var(--line-1)" }}>
                      <td className="px-4 py-3" style={{ color: "var(--text-1)" }}>
                        {userName(d.user_id)}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--text-2)" }}>
                        {d.name || "—"}
                      </td>
                      <td className="px-4 py-3 mono text-[11.5px]" style={{ color: "var(--text-4)" }}>
                        {fmtDate(d.created_at)}
                      </td>
                      <td className="px-4 py-3 mono text-[11.5px]" style={{ color: "var(--text-4)" }}>
                        {fmtDate(d.last_used_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`tag ${d.revoked ? "tag-quiet" : "tag-allow"}`}>
                          {d.revoked ? "Revoked" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!d.revoked && (
                          <button
                            onClick={() => revoke(d.device_id)}
                            disabled={revokingId === d.device_id}
                            className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded transition-colors"
                            style={{ color: "var(--sev-block)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sev-block-wash)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {revokingId === d.device_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </Console>
    </div>
  );
}
