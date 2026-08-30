import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, AlertCircle, ArrowRight, Check, Mail } from "lucide-react";
import api from "../api/axios";
import { apiErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import AuthShell, { AsideProof } from "../components/AuthShell";
import { toRole } from "../components/RoleChoice";
import GoogleAuthButton from "../components/GoogleAuthButton";

/** Password strength, judged honestly — length first, variety second. */
function strengthOf(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (pw.length < 8) return { score: 0, label: "Too short" };
  const variety =
    Number(/[a-z]/.test(pw)) +
    Number(/[A-Z]/.test(pw)) +
    Number(/\d/.test(pw)) +
    Number(/[^A-Za-z0-9]/.test(pw));
  if (pw.length >= 16 || (pw.length >= 12 && variety >= 3)) return { score: 3, label: "Strong" };
  if (pw.length >= 12 || variety >= 3) return { score: 2, label: "Reasonable" };
  return { score: 1, label: "Weak" };
}

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // An invite token (from /register?invite=…) carries a pre-assigned role
  // and organisation. The backend validates it; here it only changes copy
  // and is forwarded on submit.
  const invite = params.get("invite");

  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const strength = strengthOf(password);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");

    if (name.trim().length < 2) return setError("Enter your full name.");
    const id = identifier.trim();
    if (!id) return setError("Enter your work email or phone number.");
    if (!id.includes("@") && !/^\+?[\d\s-]{8,15}$/.test(id))
      return setError("That doesn't look like an email address or phone number.");
    if (password.length < 8) return setError("Use a password of at least 8 characters.");

    setBusy(true);
    try {
      const { data } = await api.post("/auth/register", {
        name: name.trim(),
        identifier: id,
        password,
        ...(invite ? { invite } : {}),
      });

      // Public registration creates a plain employee account. The one
      // exception is a valid invite token, which the server (not this
      // client) resolves to a pre-assigned role — RegisterBody.role is
      // still accepted-and-ignored. toRole guards the response shape either
      // way rather than assuming.
      const granted = toRole(data.role);
      login(data.access_token, granted, data.name, data.user_id || "");
      navigate(granted === "admin" || granted === "manager" ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      setError(
        apiErrorMessage(err, "We couldn't create your account. Try again in a moment.")
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      aside={
        <AsideProof
          eyebrow="Get started"
          headline="Two weeks in monitor-only mode tells you more than any vendor demo."
          points={[
            { k: "Deploy", v: "Push the extension to Chrome or Edge — no endpoint agent, no proxy" },
            { k: "Observe", v: "Watch where company data actually goes, without blocking anything" },
            { k: "Enforce", v: "Turn on the rules that matter once you've seen the real traffic" },
          ]}
        />
      }
    >
      <div className="mb-8">
        <h1 className="text-[26px] leading-tight tracking-[-0.028em] font-semibold text-slate-950">
          {invite ? "Accept your invite" : "Create your workspace"}
        </h1>
        <p className="mt-2 text-[14px] text-slate-500">
          {invite
            ? "Set up your account to join your team's workspace."
            : "Free to start. No card required."}
        </p>
      </div>

      {invite && (
        <div className="mb-5 flex items-start gap-2.5 rounded border border-signal-ink/30 bg-signal-ink/5 px-3.5 py-3">
          <Mail className="w-4 h-4 text-signal-ink mt-px flex-none" />
          <p className="text-[13px] leading-snug text-slate-600">
            You've been invited to join an existing workspace. Your role is set
            by whoever invited you.
          </p>
        </div>
      )}

      <GoogleAuthButton invite={invite} />

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
          <label htmlFor="name" className="field-label">
            Full name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="Priya Raman"
            autoFocus
            autoComplete="name"
            className="field !bg-paper-raised !border-paper-line2 !text-slate-900"
          />
        </div>

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
            autoComplete="username"
            className="field !bg-paper-raised !border-paper-line2 !text-slate-900"
          />
        </div>

        <div>
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={reveal ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="At least 8 characters"
              autoComplete="new-password"
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

          {password && (
            <div className="mt-2 flex items-center gap-2.5">
              <div className="flex gap-1 flex-1" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-[3px] flex-1 rounded-full transition-colors duration-200"
                    style={{
                      background:
                        strength.score > i
                          ? strength.score === 1
                            ? "#8A5A00"
                            : strength.score === 2
                            ? "#1657C4"
                            : "#177530"
                          : "#BFC9D6",
                    }}
                  />
                ))}
              </div>
              <span className="mono text-[10px] tracking-[0.09em] uppercase text-slate-500 w-[76px] text-right">
                {strength.label}
              </span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="btn w-full !bg-slate-900 !text-paper hover:!bg-slate-800 !py-2.5 mt-1"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {invite ? "Joining" : "Creating workspace"}
            </>
          ) : (
            <>
              {invite ? "Join workspace" : "Create workspace"}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <ul className="mt-6 space-y-2">
        {[
          invite
            ? "Your role is set by whoever invited you"
            : "You'll be the administrator of your new workspace",
          "Detection runs on-device — content stays in the browser",
        ].map((t) => (
          <li key={t} className="flex items-start gap-2.5">
            <Check className="w-3.5 h-3.5 text-signal-ink mt-0.5 flex-none" strokeWidth={2.5} />
            <span className="text-[12.5px] text-slate-500 leading-snug">{t}</span>
          </li>
        ))}
      </ul>

      <div className="rule !bg-paper-line my-7" />

      <p className="text-[13.5px] text-slate-500">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-slate-900 font-medium hover:text-signal-ink transition-colors"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
