import { Link } from "react-router-dom";
import Mark, { Wordmark } from "./Mark";
import useMarketingSurface from "../hooks/useMarketingSurface";

/**
 * Split auth layout: an instrument panel carrying real product substance on
 * the left, the form on the right. The left panel is decoration only in the
 * sense that it's non-interactive — the content in it is true.
 */
export default function AuthShell({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside: React.ReactNode;
}) {
  useMarketingSurface();

  return (
    <div className="tokens-light min-h-screen bg-paper text-slate-900 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      {/* ── Instrument panel ──────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col justify-between bg-ink text-slate-200 p-10 xl:p-14 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.35] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #1D242C 1px, transparent 1px), linear-gradient(to bottom, #1D242C 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 80% 60% at 30% 40%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 30% 40%, black, transparent)",
          }}
        />
        <Link to="/" className="relative text-slate-100 hover:opacity-75 transition-opacity w-fit">
          <Wordmark size={21} />
        </Link>
        <div className="relative">{aside}</div>
        <p className="relative mono text-[10.5px] tracking-[0.07em] uppercase text-slate-600">
          © {new Date().getFullYear()} SecureDesk · Browser data protection
        </p>
      </aside>

      {/* ── Form ──────────────────────────────────────────────── */}
      <main className="flex flex-col min-h-screen lg:min-h-0">
        <div className="lg:hidden border-b border-paper-line px-6 h-16 flex items-center">
          <Link to="/" className="text-slate-900">
            <Wordmark size={20} />
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Small stat/quote block used inside the auth aside. */
export function AsideProof({
  eyebrow,
  headline,
  points,
}: {
  eyebrow: string;
  headline: string;
  points: { k: string; v: string }[];
}) {
  return (
    <div className="max-w-[440px]">
      <div className="flex items-center gap-2 mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-signal-bright animate-pulse-dot" />
        <span className="eyebrow" style={{ color: "#2FD4B8" }}>
          {eyebrow}
        </span>
      </div>
      <h2 className="text-[27px] leading-[1.18] tracking-[-0.028em] font-semibold text-white">
        {headline}
      </h2>
      <dl className="mt-9 border-t border-[#1D242C]">
        {points.map((p) => (
          <div key={p.k} className="flex items-start gap-5 py-3.5 border-b border-[#1D242C]">
            <dt className="mono text-[10.5px] tracking-[0.1em] uppercase text-[#4C5C6B] w-[104px] flex-none pt-0.5">
              {p.k}
            </dt>
            <dd className="text-[13.5px] text-slate-300 leading-snug">{p.v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 flex items-start gap-2.5">
        <Mark size={15} tone="#2FD4B8" className="mt-0.5 flex-none" />
        <p className="text-[12.5px] leading-relaxed text-slate-400">
          Detection runs on-device. The raw content never reaches our servers —
          only the decision does.
        </p>
      </div>
    </div>
  );
}
