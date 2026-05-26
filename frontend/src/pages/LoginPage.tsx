import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { Shield, Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [id, setId]    = useState("");
  const [pw, setPw]    = useState("");
  const [show, setShow]= useState(false);
  const [load, setLoad]= useState(false);
  const [err, setErr]  = useState("");

  const doLogin = async () => {
    setErr("");
    if (!id.trim()) { setErr("Enter your email or phone number"); return; }
    if (!pw)        { setErr("Enter your password"); return; }
    setLoad(true);
    try {
      const { data } = await api.post("/auth/login", {
        identifier: id.trim(), password: pw,
      });

      // Store role exactly as returned from backend
      const role = (data.role || "user").toLowerCase();
      login(data.access_token, role, data.name, data.user_id || "");
      toast.success(`Welcome back, ${data.name}!`);

      // Redirect based on role
      if (role === "admin" || role === "manager") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (e: any) {
      setErr(e.response?.data?.detail || "Login failed. Check your credentials.");
    } finally { setLoad(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-2xl shadow-indigo-500/30 mb-4">
            <Shield className="w-8 h-8 text-white"/>
          </div>
          <h1 className="text-2xl font-bold text-white">Sign In to SecureDesk</h1>
          <p className="text-gray-500 text-sm mt-1">AI-Powered Data Loss Prevention</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">

          {err && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 mb-5 flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">⚠️</span>
              <p className="text-red-400 text-sm">{err}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Email or Phone Number
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"/>
                <input value={id}
                  onChange={e => { setId(e.target.value); setErr(""); }}
                  onKeyDown={e => e.key === "Enter" && doLogin()}
                  placeholder="you@company.com  or  9876543210"
                  autoFocus autoComplete="username"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"/>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</label>
                <Link to="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"/>
                <input type={show ? "text" : "password"} value={pw}
                  onChange={e => { setPw(e.target.value); setErr(""); }}
                  onKeyDown={e => e.key === "Enter" && doLogin()}
                  placeholder="Your password" autoComplete="current-password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-12 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"/>
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                  {show ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>

            <button onClick={doLogin} disabled={load}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-500/20">
              {load ? <Loader2 className="w-4 h-4 animate-spin"/> : <Shield className="w-4 h-4"/>}
              {load ? "Signing in..." : "Sign In"}
            </button>
          </div>

          <div className="mt-5 bg-indigo-950/30 border border-indigo-800/30 rounded-xl p-3">
            <p className="text-xs text-gray-500">
              <span className="text-indigo-400 font-medium">New here?</span>{" "}
              <Link to="/register" className="text-indigo-400 underline">Create an account</Link>
              {" "}and choose your role (Admin / Manager / Employee).
            </p>
          </div>
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          No account?{" "}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">Register here</Link>
        </p>
        <p className="text-center text-gray-700 text-xs mt-3">Built with love from Sanskar Hadole ❤️</p>
      </div>
    </div>
  );
}
