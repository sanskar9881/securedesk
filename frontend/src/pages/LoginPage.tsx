import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import api from "../api/axios";
import { apiErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import AuthShell, { AsideProof } from "../components/AuthShell";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");

    if (!identifier.trim()) return setError("Enter your work email or phone number.");
    if (!password) return setError("Enter your password.");

    setBusy(true);
    try {
      const { data } = await api.post("/auth/login", {
        identifier: identifier.trim(),
        password,
      });

      // The server is the only authority on role — we never ask the user.
      const role = (data.role || "user").toLowerCase();
      login(data.access_token, role, data.name, data.user_id || "");
      navigate(role === "admin" || role === "manager" ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      setError(
        apiErrorMessage(err, "We couldn't sign you in. Check your email and password, then try again.")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      aside={
        <AsideProof
          eyebrow="Security console"
          headline="Every decision your policies made, with the reason attached."
          points={[
            { k: "Events", v: "Paste, upload, and form submissions across Chrome and Edge" },
            { k: "Decisions", v: "Allow, warn, or block — traced back to the rule that fired" },
            { k: "Incidents", v: "Triage, resolve, and mark false positives with a full audit trail" },
          ]}
        />
      }
    >
      <div className="mb-8">
        <h1 className="text-[26px] leading-tight tracking-[-0.028em] font-semibold text-slate-950">
          Sign in
        </h1>
        <p className="mt-2 text-[14px] text-slate-500">
          Access your organisation's security console.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded border border-block/30 bg-block-wash px-3.5 py-3"
        >
          <AlertCircle className="w-4 h-4 text-block mt-px flex-none" />
          <p className="text-[13px] leading-snug text-block">{error}</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="field-label">
            Work email or phone
          </label>
          <input
            id="identifier"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setError("");
            }}
            placeholder="you@company.com"
            autoFocus
            autoComplete="username"
            className="field !bg-paper-raised !border-paper-line2 !text-slate-900"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label htmlFor="password" className="field-label !mb-0">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-[12px] text-signal-ink hover:underline underline-offset-2"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={reveal ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              className="field !bg-paper-raised !border-paper-line2 !text-slate-900 !pr-11"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-500 hover:text-slate-800 transition-colors"
            >
              {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="btn w-full !bg-slate-900 !text-paper hover:!bg-slate-800 !py-2.5 mt-1"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="rule !bg-paper-line my-7" />

      <p className="text-[13.5px] text-slate-500">
        Don't have a workspace yet?{" "}
        <Link
          to="/register"
          className="text-slate-900 font-medium hover:text-signal-ink transition-colors"
        >
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
