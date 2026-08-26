import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import { useSidebar } from "../context/SidebarContext";
import api from "../api/axios";
import { apiErrorMessage } from "../api/errors";
import toast from "react-hot-toast";
import { Copy, Laptop2, Loader2, Plus, Trash2, X } from "lucide-react";

interface DeviceRow {
  device_id: string;
  name: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  revoked: boolean;
}

function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

/**
 * Self-service device enrollment — any signed-in employee, not just
 * admins. Distinct from pages/DevicesPage.tsx (the org-wide admin view at
 * /admin/devices, backed by GET /api/admin/devices): this one only ever
 * shows and manages the CALLER's own devices, via the self-service
 * GET/POST/DELETE /api/auth/devices. Without this page, "coverage" on the
 * admin Devices page could only ever reach 1 — an admin generating a
 * token for themselves — since there'd be no way for anyone else to
 * generate one.
 */
export default function MyDevicesPage() {
  const { collapsed } = useSidebar();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [minted, setMinted] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get("/auth/devices").then(({ data }) => setDevices(data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post("/auth/devices", { name: name.trim() || "My Chrome" });
      setMinted(data.device_token);
      setName("");
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
      await api.delete(`/auth/devices/${deviceId}`);
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
      <main className={`ml-0 min-w-0 flex-1 min-h-screen bg-gray-950 p-8 ${collapsed ? "lg:ml-[72px]" : "lg:ml-64"}`}>
        <Header title="My devices" subtitle="Enrol the SecureDesk Chrome extension" />

        <div className="max-w-lg space-y-5">
          {minted && (
            <div className="bg-green-950/30 border border-green-800/50 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold mb-1.5">Device token created — copy it now</p>
                  <p className="text-gray-400 text-xs mb-2.5">
                    Shown once. Paste it into the SecureDesk extension's popup to enrol this browser.
                  </p>
                  <code className="block px-3 py-2 rounded-lg bg-black/40 border border-gray-800 text-gray-200 text-xs break-all">
                    {minted}
                  </code>
                </div>
                <button onClick={() => setMinted(null)} className="flex-none text-gray-500 hover:text-gray-300" aria-label="Dismiss">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => copy(minted)}
                className="mt-3 flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs transition"
              >
                <Copy className="w-3.5 h-3.5" /> Copy token
              </button>
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-white text-sm font-medium mb-1">Generate a device token</p>
            <p className="text-gray-500 text-xs mb-3">
              Name it something you'll recognise later — e.g. "Work laptop".
            </p>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Work laptop"
                className="flex-1 bg-black/30 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:border-indigo-500"
              />
              <button
                onClick={generate}
                disabled={generating}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Generate
              </button>
            </div>
          </div>

          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2 px-1">
              Your devices ({devices.length})
            </p>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /></div>
              ) : devices.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-gray-600">
                  <Laptop2 className="w-8 h-8 mb-2" />
                  <p className="text-sm">No devices enrolled yet</p>
                </div>
              ) : (
                devices.map((d, i) => (
                  <div
                    key={d.device_id}
                    className={`flex items-center justify-between px-5 py-3.5 ${i < devices.length - 1 ? "border-b border-gray-800" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{d.name || "Unnamed device"}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        Added {fmtDate(d.created_at)} · Last used {fmtDate(d.last_used_at)}
                      </p>
                    </div>
                    {d.revoked ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-800 text-gray-500 flex-none ml-3">
                        Revoked
                      </span>
                    ) : (
                      <button
                        onClick={() => revoke(d.device_id)}
                        disabled={revokingId === d.device_id}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-950/40 transition flex-none ml-3"
                      >
                        {revokingId === d.device_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Revoke
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
