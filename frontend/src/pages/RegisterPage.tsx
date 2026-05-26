import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { Shield, Eye, EyeOff, User, Lock, Mail, Loader2, ChevronRight } from "lucide-react";

type Role = "user"|"manager"|"admin";
const ROLES = [
  { role:"user" as Role,    label:"Employee", icon:"👤", desc:"Scan files, history, AI chat, phishing detector",               border:"border-teal-600/50 bg-teal-950/20",   badge:"bg-teal-950/40 text-teal-400 border-teal-700/40" },
  { role:"manager" as Role, label:"Manager",  icon:"👔", desc:"All employee access + Activity logs, UEBA, AI Copilot",         border:"border-purple-600/50 bg-purple-950/20",badge:"bg-purple-950/40 text-purple-400 border-purple-700/40" },
  { role:"admin" as Role,   label:"Admin",    icon:"🏢", desc:"Full access — users, compliance, organization, billing, all",   border:"border-amber-600/50 bg-amber-950/20",  badge:"bg-amber-950/40 text-amber-400 border-amber-700/40" },
];

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [step, setStep]   = useState<1|2>(1);
  const [role, setRole]   = useState<Role>("user");
  const [showPw, setShow] = useState(false);
  const [load, setLoad]   = useState(false);
  const [err, setErr]     = useState("");
  const [form, setForm]   = useState({ name:"", identifier:"", password:"" });
  const sel = ROLES.find(r => r.role === role)!;

  const doRegister = async () => {
    setErr("");
    if (!form.name.trim() || form.name.trim().length < 2) { setErr("Enter your full name"); return; }
    if (!form.identifier.trim()) { setErr("Enter your email or phone number"); return; }
    const id = form.identifier.trim();
    if (!id.includes("@") && !/^\+?[\d\s\-]{8,15}$/.test(id)) {
      setErr("Enter a valid email (you@gmail.com) or phone (9876543210)"); return;
    }
    if (form.password.length < 6) { setErr("Password must be at least 6 characters"); return; }
    
    // Validate role before sending
    const validRoles = ["user", "manager", "admin"];
    if (!validRoles.includes(role)) {
      setErr("Invalid role selected. Please start over."); return;
    }
    
    setLoad(true);
    try {
      const payload = {
        name: form.name.trim(), 
        identifier: id, 
        password: form.password, 
        role: role.toLowerCase(), // Ensure lowercase
      };
      
      const { data } = await api.post("/auth/register", payload);
      
      // Validate response contains role
      if (!data.role) {
        setErr("Server error: role not returned. Please try again.");
        return;
      }
      
      const actualRole = (data.role || role).toLowerCase();
      login(data.access_token, actualRole, data.name, data.user_id || "");
      toast.success(`Account created! Welcome, ${data.name}`);
      navigate(actualRole === "admin" || actualRole === "manager" ? "/admin" : "/dashboard");
    } catch (e: any) {
      setErr(e.response?.data?.detail || "Registration failed. Try again.");
    } finally { setLoad(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-2xl shadow-indigo-500/30 mb-4">
            <Shield className="w-8 h-8 text-white"/>
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">SecureDesk — AI Data Protection</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {[{n:1,l:"Choose Role"},{n:2,l:"Your Details"}].map((s,i)=>(
            <div key={s.n} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step>s.n?"bg-green-500 text-white":step===s.n?"bg-indigo-600 text-white":"bg-gray-800 text-gray-500"}`}>
                {step>s.n?"✓":s.n}
              </div>
              <span className={`text-sm ${step>=s.n?"text-white":"text-gray-600"}`}>{s.l}</span>
              {i<1&&<ChevronRight className="w-3.5 h-3.5 text-gray-700 ml-1"/>}
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {step===1 ? (
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">Select Your Role</h2>
              <p className="text-gray-500 text-sm mb-5">This controls what you can see and do</p>
              <div className="space-y-3 mb-6">
                {ROLES.map(opt=>(
                  <button key={opt.role} onClick={()=>setRole(opt.role)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${role===opt.role?opt.border:"border-gray-800 hover:border-gray-700"}`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${role===opt.role?"bg-gray-700":"bg-gray-800"}`}>{opt.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-semibold text-sm ${role===opt.role?"text-white":"text-gray-300"}`}>{opt.label}</span>
                        {role===opt.role&&<span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Selected</span>}
                      </div>
                      <p className="text-gray-500 text-xs">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={()=>setStep(2)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
                Continue as {sel.label} <ChevronRight className="w-4 h-4"/>
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <button onClick={()=>{setStep(1);setErr("");}} className="text-gray-500 hover:text-white text-sm transition">← Back</button>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${sel.badge}`}>
                  {sel.icon} {sel.label}
                </div>
              </div>
              <h2 className="text-white font-semibold text-lg mb-1">Your Details</h2>
              <p className="text-gray-500 text-sm mb-5">Fill in to create your account</p>
              {err&&(
                <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
                  <span className="flex-shrink-0">⚠️</span>
                  <p className="text-red-400 text-sm">{err}</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"/>
                    <input value={form.name} onChange={e=>{setForm({...form,name:e.target.value});setErr("");}}
                      placeholder="Sanskar Hadole" autoFocus
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email or Phone</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"/>
                    <input value={form.identifier} onChange={e=>{setForm({...form,identifier:e.target.value});setErr("");}}
                      placeholder="you@gmail.com  or  9876543210"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"/>
                  </div>
                  <p className="text-gray-600 text-xs mt-1.5">Gmail, company email, or 10-digit mobile number</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"/>
                    <input type={showPw?"text":"password"} value={form.password}
                      onChange={e=>{setForm({...form,password:e.target.value});setErr("");}}
                      onKeyDown={e=>e.key==="Enter"&&doRegister()}
                      placeholder="Minimum 6 characters" autoComplete="new-password"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-12 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"/>
                    <button type="button" onClick={()=>setShow(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                      {showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                </div>
                <button onClick={doRegister} disabled={load}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-500/20 mt-2">
                  {load?<Loader2 className="w-4 h-4 animate-spin"/>:<Shield className="w-4 h-4"/>}
                  {load?"Creating...":` Create ${sel.label} Account`}
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-gray-600 text-sm mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign in</Link>
        </p>
        <p className="text-center text-gray-700 text-xs mt-3">Built with love from Sanskar Hadole ❤️</p>
      </div>
    </div>
  );
}
