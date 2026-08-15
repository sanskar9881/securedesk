import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Splash from "./Splash";

type Role = "admin" | "manager" | "user";

interface Props {
  children: React.ReactNode;
  /**
   * Roles allowed through. Omit to allow any signed-in user.
   *
   * This is a UX guard only — it stops someone navigating into a screen they
   * can't use. It is NOT the security boundary: every endpoint behind these
   * screens enforces the same rule server-side, because a client-side check
   * is trivially bypassed.
   */
  allow?: Role[];
}

export default function ProtectedRoute({ children, allow }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <Splash label="Checking session" />;

  if (!user) return <Navigate to="/login" replace />;

  if (allow && !allow.includes(user.role)) {
    // Send them somewhere they can actually use rather than a dead end.
    return <Navigate to={user.role === "user" ? "/dashboard" : "/admin"} replace />;
  }

  return <>{children}</>;
}
