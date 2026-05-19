import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { Shield, Eye, EyeOff, User, Lock, Phone, Loader2, ChevronRight, Building2, UserCheck } from "lucide-react";

type Role = "user" | "admin" | "manager";

const ROLE_OPTIONS: { role: Role; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  {
    role: "user",
    label: "Employee",
    desc: "Standard access — scan files, view own history, use AI chat",
    icon: <User className="w-5 h-5"/>,
    color: "border-teal-600/50 bg-teal-950/20",
  },
  {
    role: "manager",
    label: "Manager",
    desc: "View all team activity, access AI Copilot, get alerts",
    icon: <UserCheck className="w-5 h-5"/>,
    color: "border-purple-600/50 bg-purple-950/20",
  },
  {
    role: "admin",
    label: "Admin",
    desc: "Full access — manage users, compliance, organization settings",
    icon: <Building2 className="w-5 h-5"/>,
    color: "border-amber-600/50 bg-amber-950/20",
  },
];

export default function RegisterPage() {
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const [step, setStep]         = useState<1|2>(1);
  const [selectedRole, setRole] = useState<Role>("user");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [form, setForm]         = useState({ name:"", identifier:"", password:"" });

  const handleRegister = async () => {
    if (!form.name || !form.identifier || !form.password) return toast.error("Fill all fields");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", {
        name:       form.name,
        identifier: form.identifier,
        password:   form.password,
        role:       selectedRole,
      });
      login(data.access_token, data.role, data.name);
      toast.success(`Welcome, ${data.name}! Account created as ${selectedRole}`);
      navigate(data.role === "admin" || data.role === "manager" ? "/admin" : "/dashboard");
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-2xl shadow-indigo-500/30 mb-4">
            <Shield className="w-8 h-8 text-white"/>
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Join SecureDesk — AI Data Protection Platform</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          <div className={`flex items-center gap-2 flex-1 ${step >= 1 ? "opacity-100" : "opacity-40"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-500"}`}>1</div>
            <span className="text-sm text-gray-400">Choose Role</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-700"/>
          <div className={`flex items-center gap-2 flex-1 ${step === 2 ? "opacity-100" : "opacity-40"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-500"}`}>2</div>
            <span className="text-sm text-gray-400">Your Details</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">

          {/* Step 1 — Role selection */}
          {step === 1 && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">Select Your Role</h2>
              <p className="text-gray-500 text-sm mb-6">Choose the role that matches your position in the company</p>
              <div className="space-y-3 mb-8">
                {ROLE_OPTIONS.map(opt => (
                  <button key={opt.role} onClick={() => setRole(opt.role)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                      selectedRole === opt.role ? opt.color + " border-opacity-100" : "border-gray-800 bg-transparent hover:border-gray-700"
                    }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      selectedRole === opt.role
                        ? opt.role === "admin" ? "bg-amber-600/30 text-amber-400"
                          : opt.role === "manager" ? "bg-purple-600/30 text-purple-400"
                          : "bg-teal-600/30 text-teal-400"
                        : "bg-gray-800 text-gray-500"
                    }`}>
                      {opt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm ${selectedRole === opt.role ? "text-white" : "text-gray-300"}`}>{opt.label}</span>
                        {selectedRole === opt.role && (
                          <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Selected</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(2)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
                Continue as {ROLE_OPTIONS.find(r => r.role === selectedRole)?.label} <ChevronRight className="w-4 h-4"/>
              </button>
            </div>
          )}

          {/* Step 2 — Details */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setStep(1)} className="text-gray-500 hover:text-white transition text-sm">← Back</button>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                  selectedRole === "admin" ? "bg-amber-950/30 border-amber-700/40 text-amber-400" :
                  selectedRole === "manager" ? "bg-purple-950/30 border-purple-700/40 text-purple-400" :
                  "bg-teal-950/30 border-teal-700/40 text-teal-400"
                }`}>
                  {ROLE_OPTIONS.find(r => r.role === selectedRole)?.icon}
                  <span className="text-xs font-semibold capitalize">{selectedRole}</span>
                </div>
              </div>

              <h2 className="text-white font-semibold text-lg mb-1">Your Details</h2>
              <p className="text-gray-500 text-sm mb-6">Fill in your information to create your account</p>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"/>
                    <input value={form.name} onChange={e => setForm({...form, name:e.target.value})}
                      placeholder="Sanskar Hadole" autoFocus
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"/>
                  </div>
                </div>

                {/* Email or phone */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email or Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"/>
                    <input value={form.identifier} onChange={e => setForm({...form, identifier:e.target.value})}
                      placeholder="you@company.com or 9876543210"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"/>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"/>
                    <input type={showPw ? "text" : "password"} value={form.password}
                      onChange={e => setForm({...form, password:e.target.value})}
                      onKeyDown={e => e.key === "Enter" && handleRegister()}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-12 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"/>
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition">
                      {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                </div>

                <button onClick={handleRegister} disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-500/20 mt-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Shield className="w-4 h-4"/>}
                  {loading ? "Creating Account..." : "Create Account"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition">Sign in</Link>
        </p>
        <p className="text-center text-gray-700 text-xs mt-4">Built with love from Sanskar Hadole ❤️</p>
      </div>
    </div>
  );
}
