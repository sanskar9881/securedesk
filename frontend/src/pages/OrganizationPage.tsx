import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useSidebar } from "../context/SidebarContext";
import api from "../api/axios";
import { apiErrorMessage } from "../api/errors";
import toast from "react-hot-toast";
import { Building2, Users, UserPlus, Copy, CheckCircle, Loader2, Globe, Briefcase } from "lucide-react";

interface Org { _id:string; name:string; domain:string; industry:string; size:string; owner_name:string; plan:string; created_at:string; members: { user_id: string; name: string; role: string }[]; }
interface Member { _id:string; name:string; role:string; email:string; created_at:string; }

export default function OrganizationPage() {
  const { collapsed } = useSidebar();
  const [org, setOrg]           = useState<Org | null>(null);
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied]     = useState<string|null>(null);
  const [form, setForm]         = useState({ name:"", domain:"", industry:"IT", size:"1-50" });
  const [invForm, setInvForm]   = useState({ email:"", role:"user" });
  const [invLink, setInvLink]   = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [orgRes, memRes] = await Promise.all([api.get("/org/me"), api.get("/org/members")]);
      setOrg(orgRes.data.org);
      setMembers(memRes.data);
    } catch {
      /* non-critical fetch: the view renders its empty state instead */
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createOrg = async () => {
    if (!form.name || !form.domain) return toast.error("Name and domain required");
    setCreating(true);
    try {
      await api.post("/org/create", form);
      toast.success("Organization created!");
      load();
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, "Failed to create"));
    } finally { setCreating(false); }
  };

  const invite = async () => {
    if (!invForm.email) return toast.error("Enter an email");
    setInviting(true);
    try {
      const { data } = await api.post("/org/invite", invForm);
      setInvLink(data.join_link);
      toast.success(`Invitation created for ${invForm.email}`);
      setInvForm({ email:"", role:"user" });
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e, "Invite failed"));
    } finally { setInviting(false); }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(link);
    toast.success("Link copied!");
    setTimeout(() => setCopied(null), 3000);
  };

  const roleBadge = (r: string) =>
    r === "admin"   ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
    r === "manager" ? "bg-purple-500/15 text-purple-400 border border-purple-500/20" :
                      "bg-teal-500/15 text-teal-400 border border-teal-500/20";

  return (
    <div className="flex">
      <Navbar />
      <main className={`ml-0 min-w-0 flex-1 min-h-screen bg-gray-950 p-8 ${collapsed ? "lg:ml-[72px]" : "lg:ml-64"}`}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Organization</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your company and team members</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-indigo-400 animate-spin"/></div>
        ) : !org ? (
          /* Create org */
          <div className="max-w-xl">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-600/30 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-indigo-400"/>
                </div>
                <div>
                  <h2 className="text-white font-semibold">Set Up Your Organization</h2>
                  <p className="text-gray-500 text-xs">Create your company profile to start protecting your team's data</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Company Name</label>
                  <input value={form.name} onChange={e => setForm({...form, name:e.target.value})}
                    placeholder="Acme Corp" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Company Domain</label>
                  <input value={form.domain} onChange={e => setForm({...form, domain:e.target.value})}
                    placeholder="acmecorp.com" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Industry</label>
                    <select value={form.industry} onChange={e => setForm({...form, industry:e.target.value})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition">
                      {["IT","BFSI","Healthcare","Manufacturing","Legal","Education","E-commerce","Other"].map(i => <option key={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Team Size</label>
                    <select value={form.size} onChange={e => setForm({...form, size:e.target.value})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition">
                      {["1-10","10-50","50-200","200-500","500+"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={createOrg} disabled={creating}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Building2 className="w-4 h-4"/>}
                  {creating ? "Creating..." : "Create Organization"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl space-y-6">
            {/* Org card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {org.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-white text-xl font-bold">{org.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-gray-500 text-xs"><Globe className="w-3 h-3"/>{org.domain}</span>
                      <span className="flex items-center gap-1 text-gray-500 text-xs"><Briefcase className="w-3 h-3"/>{org.industry}</span>
                      <span className="flex items-center gap-1 text-gray-500 text-xs"><Users className="w-3 h-3"/>{org.size} employees</span>
                    </div>
                  </div>
                </div>
                <span className="bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 text-xs font-bold px-3 py-1.5 rounded-full uppercase">
                  {org.plan} plan
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-gray-800">
                <div><p className="text-gray-500 text-xs">Total Members</p><p className="text-white text-2xl font-bold mt-1">{members.length}</p></div>
                <div><p className="text-gray-500 text-xs">Owner</p><p className="text-white text-sm font-medium mt-1">{org.owner_name}</p></div>
                <div><p className="text-gray-500 text-xs">Created</p><p className="text-white text-sm mt-1">{new Date(org.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</p></div>
              </div>
            </div>

            {/* Invite employee */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400"/> Invite Employee
              </h3>
              <div className="flex gap-3">
                <input value={invForm.email} onChange={e => setInvForm({...invForm, email:e.target.value})}
                  placeholder="employee@company.com" className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"/>
                <select value={invForm.role} onChange={e => setInvForm({...invForm, role:e.target.value})}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition">
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={invite} disabled={inviting}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition">
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin"/> : <UserPlus className="w-4 h-4"/>}
                  Invite
                </button>
              </div>
              {invLink && (
                <div className="mt-3 flex items-center gap-3 bg-green-950/30 border border-green-800/40 rounded-xl px-4 py-3">
                  <p className="text-green-400 text-xs flex-1 font-mono truncate">{invLink}</p>
                  <button onClick={() => copyLink(invLink)} className="flex items-center gap-1.5 text-xs text-green-400 hover:text-white transition flex-shrink-0">
                    {copied === invLink ? <CheckCircle className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                    {copied === invLink ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}
            </div>

            {/* Members table */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400"/> Team Members ({members.length})
                </h3>
              </div>
              {members.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-600">
                  <Users className="w-10 h-10 mb-3"/>
                  <p className="text-sm">No members yet — invite your team above</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                    {["Member","Role","Email","Joined"].map(h => <th key={h} className="text-left px-6 py-3 font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m._id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center text-indigo-400 font-bold text-xs">{m.name?.[0]?.toUpperCase()}</div>
                            <span className="text-white font-medium">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleBadge(m.role)}`}>{m.role}</span></td>
                        <td className="px-6 py-3 text-gray-400">{m.email || "—"}</td>
                        <td className="px-6 py-3 text-gray-500 text-xs">{m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
