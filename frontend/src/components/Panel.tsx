import { Link } from "react-router-dom";
import { ArrowUpRight, Inbox } from "lucide-react";

/**
 * Standard bordered section header + body used by every console screen
 * built after the rebrand (see pages/AdminDashboard.tsx, the original of
 * this pattern — extracted here rather than duplicated so DevicesPage and
 * EvidencePage stay pixel-identical to it without importing from a page
 * module).
 */
export default function Panel({
  title,
  meta,
  href,
  hrefLabel,
  actions,
  children,
}: {
  title: string;
  meta?: string;
  href?: string;
  hrefLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md overflow-hidden min-w-0" style={{ border: "1px solid var(--line-1)" }}>
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-3"
        style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line-1)" }}
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>
            {title}
          </h2>
          {meta && (
            <span className="mono text-[10px] tracking-[0.09em] uppercase" style={{ color: "var(--text-4)" }}>
              {meta}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-none">
          {actions}
          {href && (
            <Link
              to={href}
              className="mono text-[10px] tracking-[0.09em] uppercase flex items-center gap-1 flex-none transition-colors"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
            >
              {hrefLabel || "View all"}
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
      <div style={{ background: "var(--surface-1)" }}>{children}</div>
    </section>
  );
}

export function PanelEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <Inbox className="w-5 h-5 mb-3" style={{ color: "var(--text-4)" }} />
      <p className="text-[13px]" style={{ color: "var(--text-3)" }}>
        {text}
      </p>
    </div>
  );
}

/** Small top-of-page stat card — used for the Devices coverage metric and
 * the Evidence stats row. */
export function StatCard({
  label,
  value,
  tone = "neutral",
  note,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "block" | "warn" | "allow";
  note?: string;
}) {
  const color =
    tone === "block" ? "var(--sev-block)"
    : tone === "warn" ? "var(--sev-warn)"
    : tone === "allow" ? "var(--sev-allow)"
    : "var(--text-1)";
  return (
    <div className="px-5 py-3.5" style={{ background: "var(--surface-1)", border: "1px solid var(--line-1)", borderRadius: 6 }}>
      <p className="eyebrow mb-2">{label}</p>
      <p className="text-[22px] leading-none font-semibold tracking-[-0.03em] tabular-nums" style={{ color }}>
        {value}
      </p>
      {note && (
        <p className="text-[11.5px] mt-1.5" style={{ color: "var(--text-4)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
