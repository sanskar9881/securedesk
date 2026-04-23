import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { Camera, Edit3, Save, X, Calendar, Mail, Phone, Shield, User, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AVATAR_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444",
  "#f97316","#eab308","#22c55e","#14b8a6",
  "#06b6d4","#3b82f6",
];

interface Profile {
  id: string; name: string; email?: string; phone?: string;
  role: string; dob: string; avatar_color: string; language: string; created_at: string;
}

export default function ProfilePage() {
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", dob: "", phone: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [colorPicker, setColorPicker] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.get("/profile/me").then(({ data }) => {
      setProfile(data);
      setForm({ name: data.name, dob: data.dob || "", phone: data.phone || "", email: data.email || "" });
    }).finally(() => setFetching(false));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data } = await api.put("/profile/me", form);
      setProfile(data);
      updateUser({ name: data.name, avatar_color: data.avatar_color });
      toast.success("Profile updated!");
      setEditing(false);
    } catch {
      toast.error("Update failed");
    } finally {
      setLoading(false);
    }
  };

  const changeColor = async (color: string) => {
    try {
      const { data } = await api.put("/profile/me", { avatar_color: color });
      setProfile(data);
      updateUser({ avatar_color: color });
      setColorPicker(false);
      toast.success("Avatar color updated!");
    } catch {
      toast.error("Failed to update color");
    }
  };

  if (fetching) return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-500" />
      </main>
    </div>
  );

  if (!profile) return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Failed to load profile. <button onClick={() => window.location.reload()} className="text-indigo-400 hover:underline">Retry</button></p>
      </main>
    </div>
  );

  return (
    <div className="flex">
      <Navbar />
      {/* IMPORTANT: z-index and isolation fix for profile page */}
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 p-8" style={{ position: "relative", zIndex: 0 }}>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">My Profile</h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage your personal information and preferences</p>
          </div>
        </div>

        <div className="max-w-2xl space-y-5">
          {/* Avatar Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-5">
              {/* Avatar with color picker */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl"
                  style={{ background: `linear-gradient(135deg, ${profile.avatar_color}, ${profile.avatar_color}bb)` }}
                >
                  {profile.name?.[0]?.toUpperCase()}
                </div>
                <button
                  onClick={() => setColorPicker(!colorPicker)}
                  className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg transition"
                >
                  <Camera className="w-3.5 h-3.5 text-white" />
                </button>

                {/* Color picker — rendered as fixed position to avoid overflow issues */}
                {colorPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setColorPicker(false)} />
                    <div className="absolute top-full left-0 mt-3 bg-gray-800 border border-gray-700 rounded-2xl p-4 z-50 shadow-2xl w-48">
                      <p className="text-gray-400 text-xs font-medium mb-3">Choose avatar color</p>
                      <div className="grid grid-cols-5 gap-2">
                        {AVATAR_COLORS.map((c) => (
                          <button key={c} onClick={() => changeColor(c)}
                            className={`w-8 h-8 rounded-lg transition hover:scale-110 active:scale-95 ${profile.avatar_color === c ? "ring-2 ring-white ring-offset-2 ring-offset-gray-800" : ""}`}
                            style={{ background: c }} />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white truncate">{profile.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                    profile.role === "admin" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                    : "bg-teal-500/15 text-teal-400 border border-teal-500/20"
                  }`}>{profile.role}</span>
                  <span className="text-gray-600 text-xs">·</span>
                  <span className="text-gray-500 text-xs">
                    Member since {new Date(profile.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setEditing(!editing)}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition flex-shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {editing ? "Cancel" : "Edit"}
              </button>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              Personal Information
            </h3>

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Full Name</label>
                {editing ? (
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition" />
                ) : (
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <span className="text-white text-sm">{profile.name}</span>
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Email Address</label>
                {editing ? (
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="your@email.com"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition" />
                ) : (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <span className="text-sm">{profile.email || <span className="text-gray-500">Not set</span>}</span>
                  </div>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Phone Number</label>
                {editing ? (
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91XXXXXXXXXX"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition" />
                ) : (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <span className="text-sm">{profile.phone || <span className="text-gray-500">Not set</span>}</span>
                  </div>
                )}
              </div>

              {/* DOB */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Date of Birth</label>
                {editing ? (
                  <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition" />
                ) : (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <span className="text-sm">
                      {profile.dob
                        ? new Date(profile.dob).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                        : <span className="text-gray-500">Not set</span>
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>

            {editing && (
              <div className="flex gap-3 mt-6 pt-5 border-t border-gray-800">
                <button onClick={handleSave} disabled={loading}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg shadow-indigo-500/20">
                  <Save className="w-4 h-4" />
                  {loading ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-5 py-2.5 rounded-xl text-sm transition">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            )}
          </div>

          {/* Security Info Card */}
          <div className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Account Security</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800/50 rounded-xl p-3">
                <p className="text-gray-500 text-xs">Password</p>
                <p className="text-white text-sm font-medium mt-0.5">••••••••</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-3">
                <p className="text-gray-500 text-xs">2FA Status</p>
                <p className="text-amber-400 text-sm font-medium mt-0.5">Not enabled</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-3">
                <p className="text-gray-500 text-xs">Role</p>
                <p className={`text-sm font-semibold mt-0.5 capitalize ${profile.role === "admin" ? "text-amber-400" : "text-teal-400"}`}>
                  {profile.role}
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-3">
                <p className="text-gray-500 text-xs">Language</p>
                <p className="text-white text-sm font-medium mt-0.5 capitalize">{profile.language || "English"}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}