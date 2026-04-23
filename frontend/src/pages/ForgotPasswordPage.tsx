import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import toast from "react-hot-toast";
import { Shield, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [identifier, setIdentifier] = useState("");
  const [token, setToken] = useState("");
  const [newPw, setNewPw] = useState("");
  const [devToken, setDevToken] = useState("");
  const [loading, setLoading] = useState(false);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { identifier });
      setDevToken(data.reset_token || "");
      toast.success("Reset token generated");
      setStep("reset");
    } catch {
      toast.error("Request failed");
    } finally {
      setLoading(false);
    }
  };

  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) {
      toast.error("Password too short");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: newPw });
      toast.success("Password updated! Please log in.");
      setStep("request");
      setIdentifier("");
      setToken("");
      setNewPw("");
      setDevToken("");
    } catch {
      toast.error("Invalid or expired token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/25">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {step === "request" ? (
            <form onSubmit={requestReset} className="space-y-4">
              <p className="text-gray-400 text-sm mb-4">
                Enter your email or phone and we'll generate a reset token.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Email or Phone
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition"
              >
                {loading ? "Sending..." : "Get Reset Token"}
              </button>
            </form>
          ) : (
            <form onSubmit={doReset} className="space-y-4">
              {devToken && (
                <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-4">
                  <p className="text-amber-400 text-xs font-medium mb-1">
                    Dev Mode — Reset Token (in production this goes to email/SMS):
                  </p>
                  <code className="text-amber-300 text-xs break-all">{devToken}</code>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Paste Reset Token
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your reset token"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}

          <Link
            to="/login"
            className="flex items-center gap-2 justify-center text-gray-500 hover:text-gray-300 text-sm mt-6 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}