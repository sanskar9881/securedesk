import Mark from "./Mark";

/**
 * Branded loading state — the mark breathing on the console ground.
 *
 * Used for in-app waits (auth check, route guards). The very first paint,
 * before React has even mounted, is handled by the inline copy of this in
 * index.html; the two are kept visually identical so the handoff from static
 * shell to React app is invisible.
 */
export default function Splash({ label }: { label?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: "var(--surface-0)" }}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center">
        {/* soft pulse behind the mark */}
        <span
          aria-hidden="true"
          className="absolute w-20 h-20 rounded-full animate-splash-glow"
          style={{ background: "var(--accent-wash)" }}
        />
        <Mark size={44} tone="var(--accent)" className="relative animate-splash-mark" />
      </div>

      <span className="eyebrow" style={{ color: "var(--text-4)" }}>
        {label ?? "Loading"}
      </span>
    </div>
  );
}
