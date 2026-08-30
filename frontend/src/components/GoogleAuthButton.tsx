import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios";
import { apiErrorMessage } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import { toRole } from "./RoleChoice";

/**
 * Google Sign-In button + "or" divider, shared by the Login and Register
 * screens so the two never drift.
 *
 * After the backend issues a token the outcome is handled exactly like a
 * password login: same AuthContext update, same landing route. The only
 * Google-specific step is exchanging the credential at POST /api/auth/google.
 *
 * Renders nothing when VITE_GOOGLE_CLIENT_ID is unset — the email/password
 * form below it still works with no configuration.
 */
export default function GoogleAuthButton({ invite }: { invite?: string | null }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  // Trimmed to match main.tsx — a trailing space in .env makes Google
  // Identity Services render an empty (invisible) button.
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();

  if (!clientId) return null;

  const handleGoogleSuccess = async (res: CredentialResponse) => {
    if (!res.credential) {
      toast.error("Google sign-in failed");
      return;
    }
    try {
      const { data } = await api.post("/auth/google", {
        credential: res.credential,
        ...(invite ? { invite } : {}),
      });
      // The server is the only authority on role — toRole just guards the
      // shape of the response, same as the password login path.
      const role = toRole(data.role);
      login(data.access_token, role, data.name, data.user_id || "");
      navigate(role === "admin" || role === "manager" ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, "Google sign-in failed"));
    }
  };

  return (
    <div className="mb-6">
      {/* color-scheme:dark keeps the rendered iframe button dark to match
          theme="filled_black" regardless of the OS setting. */}
      <div className="flex justify-center [color-scheme:dark]">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => toast.error("Google sign-in failed")}
          theme="filled_black"
          size="large"
          width="368"
          text="signin_with"
        />
      </div>

      <div className="mt-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-paper-line" />
        <span className="mono text-[10px] tracking-[0.12em] uppercase text-slate-400">
          or sign in with email
        </span>
        <span className="h-px flex-1 bg-paper-line" />
      </div>
    </div>
  );
}
