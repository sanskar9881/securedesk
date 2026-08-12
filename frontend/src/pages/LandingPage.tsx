import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Minus } from "lucide-react";
import Mark, { Wordmark } from "../components/Mark";
import useMarketingSurface from "../hooks/useMarketingSurface";

/* ═══════════════════════════════════════════════════════════════
   Live interception panel — the product's core moment, shown.
   An employee pastes customer records into ChatGPT. SecureDesk
   classifies it on-device, matches policy, and blocks it.
   ═══════════════════════════════════════════════════════════════ */

const TRACE = [
  { t: "00.000", label: "paste detected", detail: "2,318 chars → chatgpt.com" },
  { t: "00.004", label: "destination resolved", detail: "ChatGPT · AI_TOOL · untrusted" },
  { t: "00.011", label: "content classified", detail: "CUSTOMER_PII · confidence 0.94" },
  { t: "00.013", label: "policy matched", detail: "AI-PROTECTION-001" },
  { t: "00.014", label: "action enforced", detail: "BLOCKED — nothing left the browser" },
];

function InterceptPanel() {
  const [step, setStep] = useState(-1);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const run = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setStep(-1);
      TRACE.forEach((_, i) => {
        timers.current.push(
          window.setTimeout(() => setStep(i), 520 + i * 460)
        );
      });
      timers.current.push(window.setTimeout(run, 520 + TRACE.length * 460 + 3400));
    };
    run();
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const done = step >= TRACE.length - 1;

  return (
    <div
      className="rounded-lg border border-[#1D242C] bg-[#0A0E12] shadow-[0_28px_70px_-30px_rgba(10,14,18,.55)] overflow-hidden"
      role="img"
      aria-label="Demonstration: a paste of customer records into ChatGPT is classified as CUSTOMER_PII with 0.94 confidence, matched against policy AI-PROTECTION-001, and blocked in 14 milliseconds."
    >
      {/* chrome */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#1D242C] bg-[#080B0F]">
        <div className="flex items-center gap-2 min-w-0">
          <Mark size={14} tone="#2FD4B8" />
          <span className="mono text-[10px] tracking-[0.11em] uppercase text-[#6B7B8A] truncate">
            securedesk · extension
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2FD4B8] animate-pulse-dot" />
          <span className="mono text-[10px] tracking-[0.09em] uppercase text-[#2FD4B8]">
            active
          </span>
        </div>
      </div>

      {/* the trace */}
      <div className="p-3.5 space-y-px min-h-[268px]">
        {TRACE.map((row, i) => {
          const on = step >= i;
          const last = i === TRACE.length - 1;
          return (
            <div
              key={row.label}
              className="flex items-start gap-3 px-2.5 py-2 rounded-sm transition-colors duration-300"
              style={{
                background: on && last ? "rgba(242,122,110,.09)" : "transparent",
                opacity: on ? 1 : 0.18,
              }}
            >
              <span className="mono text-[10.5px] text-[#4C5C6B] pt-px tabular-nums flex-none w-[42px]">
                {row.t}
              </span>
              <span
                className="mt-[7px] w-1 h-1 rounded-full flex-none transition-colors duration-300"
                style={{ background: on ? (last ? "#F27A6E" : "#2FD4B8") : "#33414E" }}
              />
              <div className="min-w-0 flex-1">
                <div
                  className="mono text-[11px] tracking-[0.06em] uppercase transition-colors duration-300"
                  style={{ color: on ? (last ? "#F27A6E" : "#B4BFC8") : "#4C5C6B" }}
                >
                  {row.label}
                </div>
                <div className="text-[12.5px] text-[#8D9BA8] mt-0.5 truncate">
                  {row.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* what the employee sees */}
      <div className="border-t border-[#1D242C] p-3.5">
        <div
          className="rounded-md border p-3.5 transition-all duration-500"
          style={{
            borderColor: done ? "rgba(242,122,110,.34)" : "#1D242C",
            background: done ? "rgba(242,122,110,.07)" : "#080B0F",
            opacity: done ? 1 : 0.3,
          }}
        >
          <div className="flex items-start gap-2.5">
            <Mark size={15} tone={done ? "#F27A6E" : "#4C5C6B"} />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#E8ECEF] leading-snug">
                SecureDesk blocked this paste
              </p>
              <p className="text-[12px] text-[#8D9BA8] mt-1 leading-relaxed">
                It looks like customer personal information. Your organisation's
                policy doesn't allow that in external AI tools.
              </p>
              <p className="mono text-[10px] tracking-[0.08em] uppercase text-[#4C5C6B] mt-2">
                policy AI-PROTECTION-001 · contact security to request an exception
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

const DESTINATIONS = [
  { group: "AI tools",       items: ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot"] },
  { group: "Personal mail",  items: ["Gmail", "Outlook", "Proton", "Yahoo"] },
  { group: "Cloud storage",  items: ["Google Drive", "Dropbox", "OneDrive", "Box"] },
  { group: "Developer",      items: ["GitHub", "GitLab", "Stack Overflow", "Pastebin"] },
  { group: "Messaging",      items: ["Slack", "Teams", "Discord", "Telegram Web"] },
  { group: "Anything else",  items: ["Unclassified domains fall back to your default policy"] },
];

const PIPELINE = [
  { n: "01", h: "Detect the action",   p: "The extension watches for paste, form submission, and file upload — the moments data actually moves. It does not log keystrokes or browsing history." },
  { n: "02", h: "Inspect on-device",   p: "Only the content involved in that action is read, and only when a policy requires it. Classification runs locally in the browser." },
  { n: "03", h: "Resolve destination", p: "The active origin is matched against a destination registry your admins control — trusted, untrusted, or unknown." },
  { n: "04", h: "Evaluate policy",     p: "Your rules run in priority order against the classification, destination, and user. First match decides." },
  { n: "05", h: "Enforce and explain", p: "Allow, warn, or block — with a plain-language reason for the employee and a metadata-only event for your security team." },
];

const NEVER = [
  "Keystrokes or anything typed outside an inspected action",
  "Browsing history or the pages an employee visits",
  "The raw sensitive content itself — only its classification",
  "Personal accounts, personal devices, or off-hours activity",
];

const PLANS = [
  { name: "Starter",    price: "₹2,999",  unit: "/month", seats: "Up to 10 seats",   pts: ["Browser extension", "Deterministic detection", "Policy engine", "Event dashboard"], cta: "Start free" },
  { name: "Business",   price: "₹8,999",  unit: "/month", seats: "Up to 100 seats",  pts: ["Everything in Starter", "Incident workflow", "Custom detection patterns", "Audit log export"], cta: "Start free", featured: true },
  { name: "Enterprise", price: "Custom",  unit: "",       seats: "Unlimited seats",  pts: ["Everything in Business", "SSO and directory sync", "Managed deployment", "Priority support"], cta: "Talk to us" },
];

export default function LandingPage() {
  useMarketingSurface();

  return (
    <div className="tokens-light min-h-screen bg-paper text-slate-900 antialiased">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-paper/85 backdrop-blur-md border-b border-paper-line">
        <div className="max-w-shell mx-auto px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <Link to="/" className="text-slate-900 hover:opacity-70 transition-opacity">
            <Wordmark size={21} />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[13.5px] text-slate-600">
            <a href="#how" className="hover:text-slate-900 transition-colors">How it works</a>
            <a href="#coverage" className="hover:text-slate-900 transition-colors">Coverage</a>
            <a href="#privacy" className="hover:text-slate-900 transition-colors">Privacy</a>
            <Link to="/pricing" className="hover:text-slate-900 transition-colors">Pricing</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden sm:inline-flex text-[13.5px] text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-[13.5px] font-medium bg-slate-900 text-paper hover:bg-slate-800 px-3.5 py-2 rounded transition-colors"
            >
              Get started
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-paper-line">
        <div className="max-w-shell mx-auto px-6 lg:px-8 pt-14 pb-16 lg:pt-20 lg:pb-20">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-14 lg:gap-16 items-center">
            {/* copy */}
            <div>
              <div className="inline-flex items-center gap-2 mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse-dot" />
                <span className="eyebrow">AI-era data loss prevention</span>
              </div>

              <h1 className="text-display-xl text-slate-950 max-w-[13ch]">
                Your data doesn't leak.
                <span className="block text-signal-ink">It gets pasted.</span>
              </h1>

              <p className="mt-7 text-[17px] leading-relaxed text-slate-600 max-w-[52ch]">
                Employees move customer records, source code, and credentials into
                ChatGPT, personal Gmail, and Dropbox dozens of times a day — usually
                trying to do their job faster. SecureDesk sees it at the moment it
                happens, applies your policy, and stops what shouldn't leave.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link to="/register" className="btn btn-primary !bg-slate-900 !text-paper hover:!bg-slate-800 !px-5 !py-2.5">
                  Start free
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#how" className="btn btn-secondary !border-paper-line2 !text-slate-700 hover:!bg-paper-sunk !px-5 !py-2.5">
                  See how it works
                </a>
              </div>

              <p className="mt-5 mono text-[11px] tracking-[0.06em] text-slate-400">
                No card required · Deploys to Chrome and Edge in minutes
              </p>
            </div>

            {/* the demo */}
            <div className="lg:pl-2">
              <InterceptPanel />
              <p className="mt-3 mono text-[10.5px] tracking-[0.07em] uppercase text-slate-400 text-center">
                Illustrative trace — detection and policy run on-device
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The gap ─────────────────────────────────────────────── */}
      <section className="border-b border-paper-line bg-paper-raised">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-12 lg:gap-20">
            <div>
              <p className="eyebrow mb-4">The gap</p>
              <h2 className="text-display-md text-slate-950">
                Your existing controls were built for files, not for a text box.
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-px bg-paper-line border border-paper-line rounded-lg overflow-hidden">
              {[
                { h: "Email DLP", p: "Scans attachments and message bodies. A paste into a browser tab never touches your mail server." },
                { h: "CASB / proxy", p: "Sees the domain and the request. It can't tell an approved prompt from a customer database dump." },
                { h: "Endpoint DLP", p: "Watches files on disk. Text copied from a web app to a web app leaves no file behind." },
              ].map((c) => (
                <div key={c.h} className="bg-paper-raised p-6">
                  <h3 className="text-[14px] font-semibold text-slate-900 mb-2">{c.h}</h3>
                  <p className="text-[13.5px] leading-relaxed text-slate-600">{c.p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section id="how" className="border-b border-paper-line scroll-mt-16">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-narrow mb-14">
            <p className="eyebrow mb-4">How it works</p>
            <h2 className="text-display-md text-slate-950">
              Five stages, all of them on the employee's machine.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-slate-600 max-w-measure">
              The decision never waits on a network round-trip — that's what keeps it
              invisible in normal use. Your backend receives the outcome, not the content.
            </p>
          </div>

          <ol className="border-t border-paper-line">
            {PIPELINE.map((s) => (
              <li
                key={s.n}
                className="grid sm:grid-cols-[64px_minmax(0,300px)_minmax(0,1fr)] gap-x-6 gap-y-2 py-7 border-b border-paper-line group"
              >
                <span className="mono text-[12px] text-slate-400 tabular-nums pt-0.5 group-hover:text-signal-ink transition-colors">
                  {s.n}
                </span>
                <h3 className="text-[15.5px] font-semibold text-slate-900">{s.h}</h3>
                <p className="text-[14px] leading-relaxed text-slate-600">{s.p}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Coverage ────────────────────────────────────────────── */}
      <section id="coverage" className="border-b border-paper-line bg-paper-raised scroll-mt-16">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-narrow mb-12">
            <p className="eyebrow mb-4">Coverage</p>
            <h2 className="text-display-md text-slate-950">
              Destinations your admins control, not a list we decide for you.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-slate-600 max-w-measure">
              Every destination carries a category, a risk level, and a trust status.
              Mark your own AI tenant as approved; treat everything unrecognised
              however your policy says.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-paper-line border border-paper-line rounded-lg overflow-hidden">
            {DESTINATIONS.map((d) => (
              <div key={d.group} className="bg-paper-raised p-6">
                <p className="eyebrow eyebrow-accent mb-3.5">{d.group}</p>
                <ul className="space-y-1.5">
                  {d.items.map((i) => (
                    <li key={i} className="text-[13.5px] text-slate-700 leading-snug">
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy stance ──────────────────────────────────────── */}
      <section id="privacy" className="border-b border-paper-line scroll-mt-16">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div>
              <p className="eyebrow mb-4">Privacy by construction</p>
              <h2 className="text-display-md text-slate-950">
                A tool that watches employees has to be worth trusting.
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-slate-600 max-w-measure">
                SecureDesk records that a policy fired — the classification, the
                destination, the decision. It does not record what was written. That's
                an architectural property, not a setting: the raw content never leaves
                the browser, so there is no copy of it for us to hold, for an
                administrator to browse, or for an attacker to steal.
              </p>
              <p className="mt-4 text-[16px] leading-relaxed text-slate-600 max-w-measure">
                It's also the honest answer when your works council, your DPO, or the
                employees themselves ask what this thing actually sees.
              </p>
            </div>

            <div className="border border-paper-line rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-paper-line bg-paper-sunk">
                <p className="eyebrow">What SecureDesk never collects</p>
              </div>
              <ul className="divide-y divide-paper-line">
                {NEVER.map((n) => (
                  <li key={n} className="flex items-start gap-3 px-5 py-3.5">
                    <Minus className="w-3.5 h-3.5 text-slate-400 mt-1 flex-none" strokeWidth={2.5} />
                    <span className="text-[13.5px] text-slate-700 leading-snug">{n}</span>
                  </li>
                ))}
              </ul>
              <div className="px-5 py-3 border-t border-paper-line bg-paper-sunk">
                <p className="eyebrow">What it does record</p>
              </div>
              <ul className="divide-y divide-paper-line">
                {[
                  "Classification, confidence, and severity",
                  "Destination, browser, and device label",
                  "Which policy fired and what action was taken",
                ].map((n) => (
                  <li key={n} className="flex items-start gap-3 px-5 py-3.5">
                    <Check className="w-3.5 h-3.5 text-signal-ink mt-1 flex-none" strokeWidth={2.5} />
                    <span className="text-[13.5px] text-slate-700 leading-snug">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────── */}
      <section className="border-b border-paper-line bg-paper-raised">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-narrow mb-12">
            <p className="eyebrow mb-4">Pricing</p>
            <h2 className="text-display-md text-slate-950">Priced for the companies that actually have this problem.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`rounded-lg border p-6 flex flex-col ${
                  p.featured
                    ? "border-slate-900 bg-paper shadow-panel"
                    : "border-paper-line bg-paper"
                }`}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="text-[14px] font-semibold text-slate-900">{p.name}</h3>
                  {p.featured && <span className="tag tag-accent">Most chosen</span>}
                </div>
                <p className="mono text-[11px] tracking-[0.07em] uppercase text-slate-400 mb-5">{p.seats}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-[30px] font-semibold tracking-[-0.03em] text-slate-950 tabular-nums">{p.price}</span>
                  <span className="text-[13px] text-slate-500">{p.unit}</span>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {p.pts.map((pt) => (
                    <li key={pt} className="flex items-start gap-2.5">
                      <Check className="w-3.5 h-3.5 text-signal-ink mt-0.5 flex-none" strokeWidth={2.5} />
                      <span className="text-[13.5px] text-slate-700 leading-snug">{pt}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={p.name === "Enterprise" ? "/pricing" : "/register"}
                  className={`btn w-full ${
                    p.featured
                      ? "!bg-slate-900 !text-paper hover:!bg-slate-800"
                      : "btn-secondary !border-paper-line2 !text-slate-800 hover:!bg-paper-sunk"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="bg-ink text-slate-100">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-narrow">
            <p className="eyebrow eyebrow-accent mb-5" style={{ color: "#2FD4B8" }}>
              Early access
            </p>
            <h2 className="text-display-lg text-white">
              Find out what's already leaving your browser.
            </h2>
            <p className="mt-6 text-[16.5px] leading-relaxed text-slate-300 max-w-measure">
              Deploy SecureDesk in monitor-only mode for two weeks. No blocking, no
              disruption — just an honest picture of where company data is going.
              Then decide what to enforce.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/register" className="btn !bg-signal-bright !text-[#041410] hover:!bg-[#1A9E88] !px-5 !py-2.5">
                Create your workspace
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="mailto:sanskar@securedesk.in"
                className="btn !border-[#2A333D] !text-slate-200 border hover:!bg-[#11161C] !px-5 !py-2.5"
              >
                Talk to the team
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-ink border-t border-[#1D242C] text-slate-400">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="text-slate-300">
              <Wordmark size={19} />
            </div>
            <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[13px]">
              <Link to="/pricing" className="hover:text-slate-200 transition-colors">Pricing</Link>
              <Link to="/login" className="hover:text-slate-200 transition-colors">Sign in</Link>
              <a href="mailto:sanskar@securedesk.in" className="hover:text-slate-200 transition-colors">Contact</a>
            </nav>
          </div>
          <div className="rule !bg-[#1D242C] my-7" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="mono text-[11px] tracking-[0.06em] text-slate-500">
              © {new Date().getFullYear()} SecureDesk · securedesk.in
            </p>
            <p className="mono text-[11px] tracking-[0.06em] text-slate-600">
              Browser data protection for Chrome and Edge
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
