import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { apiErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import AuthShell, { AsideProof } from "../components/AuthShell";
import RoleChoice, { ROLES, type Role, toRole } from "../components/RoleChoice";
import GoogleAuthButton from "../components/GoogleAuthButton";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // Which console the person means to open. A hint, NOT an authorisation
  // control and NOT a gate — the server signs the token with the role held
  // in the database regardless. If the pick turns out to be wrong we don't
  // block the sign-in; we correct it with a toast and route to the console
  // that matches their real role.
  const [entry, setEntry] = useState<Role>("user");
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
        expected_role: entry,
      });

      // The server is the only authority on role. If the person picked the
      // wrong console, don't fail the login — sign them in, tell them their
      // actual role, and send them to the right place.
      const role = toRole(data.role);
      login(data.access_token, role, data.name, data.user_id || "");
      if (role !== entry) {
        const label = ROLES.find((r) => r.id === role)?.label ?? role;
        toast(`Your account role is ${label}. Signing you in there.`, { icon: "ℹ️" });
      }
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

      <GoogleAuthButton />

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
        <RoleChoice
          legend="Sign in as"
          value={entry}
          onChange={(r) => {
            setEntry(r);
            setError("");
          }}
        />

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
