import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Header, { Console } from "../components/Header";
import Panel, { PanelEmpty, StatCard } from "../components/Panel";
import { ROLES } from "../components/RoleChoice";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { apiErrorMessage } from "../api/errors";
import toast from "react-hot-toast";
import { AlertTriangle, Copy, Loader2, Mail, Trash2, X } from "lucide-react";

interface UserRecord {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  created_at: string;
}
interface InviteRecord {
  token: string;
  email: string;
  role: string;
  invited_by_name: string;
  created_at: string;
  expires_at: string;
}
interface NewInvite {
  email: string;
  role: string;
  invite_url: string;
  expires_at: string;
  emailed: boolean;
}

/** admin | manager | user  ->  Administrator | Manager | Employee */
const roleLabel = (id: string) => ROLES.find((r) => r.id === id)?.label ?? id;

function roleTagClass(id: string) {
  if (id === "admin") return "tag tag-warn";
  if (id === "manager") return "tag tag-accent";
  return "tag tag-quiet";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

interface PendingChange {
  user: UserRecord;
  newRole: string;
  /** "promote" → granting admin, "demote" → removing admin */
  kind: "promote" | "demote";
}

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === "admin";

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingChange | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [lastInvite, setLastInvite] = useState<NewInvite | null>(null);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/admin/users").catch(() => ({ data: [] as UserRecord[] })),
      api.get("/admin/invites").catch(() => ({ data: [] as InviteRecord[] })),
    ])
      .then(([u, i]) => {
        setUsers(u.data);
        setInvites(i.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const counts = useMemo(() => {
    const c = { admin: 0, manager: 0, user: 0 };
    for (const u of users) {
      if (u.role === "admin") c.admin++;
      else if (u.role === "manager") c.manager++;
      else c.user++;
    }
    return c;
  }, [users]);

  // ── Role changes ──────────────────────────────────────────────
  const requestRoleChange = (u: UserRecord, newRole: string) => {
    if (newRole === u.role) return;

    if (u._id === me?.id && newRole !== "admin") {
      toast.error("You can't remove your own administrator access.");
      return;
    }

    const promoting = newRole === "admin";
    const demoting = u.role === "admin";
    if (promoting || demoting) {
      setConfirm({ user: u, newRole, kind: promoting ? "promote" : "demote" });
      return;
    }
    applyRoleChange(u, newRole);
  };

  const applyRoleChange = async (u: UserRecord, newRole: string) => {
    setSavingId(u._id);
    try {
      const { data } = await api.patch(`/admin/users/${u._id}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((x) => (x._id === u._id ? { ...x, role: data.role ?? newRole } : x)),
      );
      toast.success(`${u.name} is now ${roleLabel(data.role ?? newRole).toLowerCase()}.`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't change that role."));
    } finally {
      setSavingId(null);
    }
  };

  const confirmRoleChange = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    await applyRoleChange(confirm.user, confirm.newRole);
    setConfirmBusy(false);
    setConfirm(null);
  };

  // ── Invites ───────────────────────────────────────────────────
  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setInviteBusy(true);
    try {
      const { data } = await api.post("/admin/invite", { email, role: inviteRole });
      setLastInvite(data);
      setInviteEmail("");
      toast.success(
        data.emailed ? `Invite emailed to ${data.email}.` : `Invite link ready for ${data.email}.`,
      );
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't create that invite."));
    } finally {
      setInviteBusy(false);
    }
  };

  const revokeInvite = async (token: string) => {
    setRevokingToken(token);
    try {
      await api.delete(`/admin/invites/${token}`);
      setInvites((prev) => prev.filter((i) => i.token !== token));
      if (lastInvite && invites.find((i) => i.token === token)?.email === lastInvite.email) {
        setLastInvite(null);
      }
      toast.success("Invite revoked.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't revoke that invite."));
    } finally {
      setRevokingToken(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };

  const roleOptions = ROLES.map((r) => (
    <option key={r.id} value={r.id}>
      {r.label}
    </option>
  ));

  return (
    <div className="flex">
      <Navbar />
      <Console>
        <Header title="People" subtitle="Roles & invitations" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="People" value={users.length} />
          <StatCard label="Administrators" value={counts.admin} tone={counts.admin ? "neutral" : "warn"} />
          <StatCard label="Managers" value={counts.manager} />
          <StatCard label="Pending invites" value={invites.length} />
        </div>

        {/* ── Invite ──────────────────────────────────────────── */}
        {isAdmin && (
          <div className="mb-6">
            <Panel title="Invite someone" meta="admin only">
              <div className="p-4">
                <form onSubmit={sendInvite} className="flex flex-col sm:flex-row gap-2.5 sm:items-end">
                  <div className="flex-1 min-w-0">
                    <label htmlFor="invite-email" className="field-label">
                      Work email
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="field"
                      autoComplete="off"
                    />
                  </div>
                  <div className="sm:w-44">
                    <label htmlFor="invite-role" className="field-label">
                      Role
                    </label>
                    <select
                      id="invite-role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="field"
                    >
                      {roleOptions}
                    </select>
                  </div>
                  <button type="submit" disabled={inviteBusy} className="btn btn-primary !py-2 !px-4 text-[13px]">
                    {inviteBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    Send Invite
                  </button>
                </form>

                <p className="text-[11.5px] mt-2.5" style={{ color: "var(--text-4)" }}>
                  Creates a single-use link that expires in 7 days. The invited person keeps the role
                  you pick here and joins this organisation. They can sign up with email or Google.
                </p>

                {lastInvite && (
                  <div
                    className="mt-4 rounded-md p-3.5"
                    style={{ background: "var(--accent-wash)", border: "1px solid var(--accent-line)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-semibold mb-1" style={{ color: "var(--text-1)" }}>
                          Invite link for {lastInvite.email} · {roleLabel(lastInvite.role)}
                        </p>
                        <p className="text-[11px] mb-2" style={{ color: "var(--text-3)" }}>
                          {lastInvite.emailed
                            ? "Emailed to them. You can also share this link directly."
                            : "Email delivery isn't configured — send this link to them yourself."}
                        </p>
                        <code
                          className="block px-3 py-2 rounded text-[11.5px] mono break-all"
                          style={{
                            background: "var(--surface-in)",
                            color: "var(--text-1)",
                            border: "1px solid var(--line-2)",
                          }}
                        >
                          {lastInvite.invite_url}
                        </code>
                        <button
                          onClick={() => copy(lastInvite.invite_url)}
                          className="btn btn-secondary !py-1.5 !px-3 text-[12px] mt-2.5"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy link
                        </button>
                      </div>
                      <button
                        onClick={() => setLastInvite(null)}
                        className="flex-none p-1 rounded"
                        style={{ color: "var(--text-4)" }}
                        aria-label="Dismiss"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        )}

        {/* ── Pending invites ─────────────────────────────────── */}
        {invites.length > 0 && (
          <div className="mb-6">
            <Panel title="Pending invites" meta={`${invites.length}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line-1)" }}>
                      {["Email", "Role", "Invited by", "Expires", ""].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 eyebrow" style={{ fontSize: "0.625rem" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((i) => (
                      <tr key={i.token} style={{ borderBottom: "1px solid var(--line-1)" }}>
                        <td className="px-4 py-3" style={{ color: "var(--text-1)" }}>
                          {i.email}
                        </td>
                        <td className="px-4 py-3">
                          <span className={roleTagClass(i.role)}>{roleLabel(i.role)}</span>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-3)" }}>
                          {i.invited_by_name || "—"}
                        </td>
                        <td className="px-4 py-3 mono text-[11.5px]" style={{ color: "var(--text-4)" }}>
                          {fmtDate(i.expires_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && (
                            <button
                              onClick={() => revokeInvite(i.token)}
                              disabled={revokingToken === i.token}
                              className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded"
                              style={{ color: "var(--sev-block)" }}
                            >
                              {revokingToken === i.token ? (
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
            </Panel>
          </div>
        )}

        {/* ── People ──────────────────────────────────────────── */}
        <Panel title="People" meta={`${users.length} total`}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : users.length === 0 ? (
            <PanelEmpty text="No people yet. Invite your team with the form above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line-1)" }}>
                    {["Name", "Email / phone", "Role", "Joined"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 eyebrow" style={{ fontSize: "0.625rem" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isMe = u._id === me?.id;
                    return (
                      <tr key={u._id} style={{ borderBottom: "1px solid var(--line-1)" }}>
                        <td className="px-4 py-3" style={{ color: "var(--text-1)" }}>
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-none"
                              style={{
                                background: "var(--accent-wash)",
                                color: "var(--accent)",
                                border: "1px solid var(--accent-line)",
                              }}
                            >
                              {u.name?.[0]?.toUpperCase() ?? "?"}
                            </span>
                            <span>
                              {u.name}
                              {isMe && (
                                <span className="ml-1.5 text-[11px]" style={{ color: "var(--text-4)" }}>
                                  (you)
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-3)" }}>
                          {u.email || u.phone || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {isAdmin ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={u.role}
                                disabled={savingId === u._id}
                                onChange={(e) => requestRoleChange(u, e.target.value)}
                                className="field !py-1.5 !px-2.5 !w-auto text-[12.5px]"
                                aria-label={`Role for ${u.name}`}
                              >
                                {roleOptions}
                              </select>
                              {savingId === u._id && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--accent)" }} />
                              )}
                            </div>
                          ) : (
                            <span className={roleTagClass(u.role)}>{roleLabel(u.role)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 mono text-[11.5px]" style={{ color: "var(--text-4)" }}>
                          {fmtDate(u.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </Console>

      {/* ── Confirmation dialog ───────────────────────────────── */}
      {confirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(4,6,10,0.62)" }}
          onClick={() => !confirmBusy && setConfirm(null)}
        >
          <div
            className="w-full max-w-[420px] rounded-lg overflow-hidden"
            style={{ background: "var(--surface-1)", border: "1px solid var(--line-2)", boxShadow: "var(--shadow-panel)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-start gap-3">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-none"
                  style={{
                    background: confirm.kind === "promote" ? "var(--sev-warn-wash)" : "var(--sev-block-wash)",
                    color: confirm.kind === "promote" ? "var(--sev-warn)" : "var(--sev-block)",
                  }}
                >
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[14.5px] font-semibold" style={{ color: "var(--text-1)" }}>
                    {confirm.kind === "promote"
                      ? `Make ${confirm.user.name} an administrator?`
                      : `Remove ${confirm.user.name}'s administrator access?`}
                  </h3>
                  <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: "var(--text-3)" }}>
                    {confirm.kind === "promote"
                      ? "Administrators can manage every account, change roles, invite and remove people, and export all organisation data."
                      : `They'll become ${roleLabel(confirm.newRole).toLowerCase()} and lose access to account management, role changes, and organisation-wide data.`}
                  </p>
                </div>
              </div>
            </div>
            <div
              className="flex justify-end gap-2 px-5 py-3.5"
              style={{ background: "var(--surface-2)", borderTop: "1px solid var(--line-1)" }}
            >
              <button
                onClick={() => setConfirm(null)}
                disabled={confirmBusy}
                className="btn btn-secondary !py-1.5 !px-3.5 text-[12.5px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmRoleChange}
                disabled={confirmBusy}
                className="btn btn-primary !py-1.5 !px-3.5 text-[12.5px]"
              >
                {confirmBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {confirm.kind === "promote" ? "Make administrator" : "Remove access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
