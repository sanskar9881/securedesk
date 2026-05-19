import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { Shield, FileCheck, CheckCircle, ChevronRight, Loader2, User } from "lucide-react";

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [step, setStep]         = useState(1);
  const [ndaText, setNdaText]   = useState("");
  const [agreed, setAgreed]     = useState(false);
  const [fullName, setFullName] = useState(user?.name || "");
  const [dept, setDept]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [signed, setSigned]     = useState(false);

  useEffect(() => {
    api.get("/onboarding/nda/text").then(({ data }) => setNdaText(data.nda_text)).catch(() => {});
    api.get("/onboarding/status").then(({ data }) => {
      if (data.onboarding_complete) navigate("/dashboard");
      if (data.nda_signed) { setSigned(true); setStep(2); }
    }).catch(() => {});
  }, []);

  const signNDA = async () => {
    if (!agreed) return toast.error("You must agree to the NDA");
    if (!fullName) return toast.error("Enter your full name");
    setLoading(true);
    try {
      await api.post("/onboarding/nda/sign", { agreed: true, full_name: fullName });
      setSigned(true);
      setStep(2);
      toast.success("NDA signed successfully!");
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to sign");
    } finally { setLoading(false); }
  };

  const completeOnboarding = async () => {
    setLoading(true);
    try {
      await api.post("/onboarding/complete", { department: dept });
      toast.success("Welcome to the team! Setup complete.");
      navigate("/dashboard");
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-2xl shadow-indigo-500/30 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to SecureDesk</h1>
          <p className="text-gray-500 text-sm mt-1">Complete setup to access your account</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[{ n:1, label:"Sign NDA" }, { n:2, label:"Complete Setup" }].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step > s.n ? "bg-green-500 text-white" : step === s.n ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-500"
              }`}>
                {step > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
              </div>
              <span className={`text-sm font-medium ${step >= s.n ? "text-white" : "text-gray-600"}`}>{s.label}</span>
              {i < 1 && <ChevronRight className="w-4 h-4 text-gray-700 ml-2" />}
            </div>
          ))}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {/* Step 1 — NDA */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-amber-600/20 border border-amber-600/30 rounded-xl flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">Data Confidentiality Agreement</h2>
                  <p className="text-gray-500 text-xs">Read and sign before accessing the platform</p>
                </div>
              </div>

              {/* NDA text */}
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 h-48 overflow-y-auto mb-5">
                <pre className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">
                  {ndaText || "Loading agreement..."}
                </pre>
              </div>

              {/* Full name */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Your Full Legal Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="As it appears on your ID"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition" />
                </div>
              </div>

              {/* Agree checkbox */}
              <label className="flex items-start gap-3 cursor-pointer mb-5 bg-gray-800/40 border border-gray-700 rounded-xl p-4 hover:border-indigo-500/50 transition">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0" />
                <span className="text-gray-300 text-sm">
                  I have read the Data Confidentiality Agreement and agree to protect all company data.
                  I understand that unauthorized sharing may result in legal action under the{" "}
                  <span className="text-indigo-400 font-medium">DPDP Act 2023</span>.
                </span>
              </label>

              <button onClick={signNDA} disabled={loading || !agreed}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                {loading ? "Signing..." : "Sign Agreement Digitally"}
              </button>
            </div>
          )}

          {/* Step 2 — Complete setup */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-green-600/20 border border-green-600/30 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">NDA Signed ✓</h2>
                  <p className="text-gray-500 text-xs">Complete your profile to finish setup</p>
                </div>
              </div>

              <div className="bg-green-950/30 border border-green-800/40 rounded-xl p-4 mb-5">
                <p className="text-green-400 text-sm font-medium">✅ Data Confidentiality Agreement signed</p>
                <p className="text-gray-500 text-xs mt-0.5">A copy has been recorded. You are legally bound by this agreement.</p>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Your Department</label>
                <select value={dept} onChange={e => setDept(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition">
                  <option value="">Select department</option>
                  {["Engineering","Finance","HR","Sales","Marketing","Legal","Operations","Management","Other"].map(d => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 mb-6 bg-indigo-950/30 border border-indigo-800/30 rounded-xl p-4">
                <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider">What happens next</p>
                {["SecureDesk will monitor your file sharing for data protection","You'll receive alerts if you try to share sensitive data","Your activity is logged for compliance and security","You can access the AI assistant and DLP tools anytime"].map(t => (
                  <p key={t} className="text-gray-400 text-xs flex items-start gap-2"><span className="text-indigo-400 flex-shrink-0 mt-0.5">•</span>{t}</p>
                ))}
              </div>

              <button onClick={completeOnboarding} disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 disabled:opacity-40 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {loading ? "Setting up..." : "Enter SecureDesk →"}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">Built with love from Sanskar Hadole ❤️</p>
      </div>
    </div>
  );
}
