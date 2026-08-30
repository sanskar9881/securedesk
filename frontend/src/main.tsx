import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";
import "./index.css";

// The OAuth client ID is public (it ships in this bundle) and must match
// the backend's GOOGLE_CLIENT_ID. When it's absent the provider is skipped
// and the Google buttons render nothing (see GoogleAuthButton), so the
// email/password flow still works with no configuration.
// .trim() guards against a stray trailing space or newline in the .env
// value — Google Identity Services silently renders nothing for a client
// ID that isn't an exact match.
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {GOOGLE_CLIENT_ID ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>
);

// Dismiss the pre-hydration splash from index.html now that React owns the
// screen. Fading rather than removing outright avoids a hard cut between the
// static shell and the first React paint.
const boot = document.getElementById("boot");
if (boot) {
  boot.classList.add("boot-done");
  boot.addEventListener("transitionend", () => boot.remove(), { once: true });
  // Belt and braces: if the transition never fires (reduced motion, tab in
  // background), drop it anyway so it can never trap clicks.
  setTimeout(() => boot.remove(), 800);
}
