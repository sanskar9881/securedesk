import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
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
