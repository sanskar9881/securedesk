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
      className="rounded-xl border border-[#343B50] bg-[#0A0C12] shadow-[0_32px_80px_-28px_rgba(5,7,10,.7)] overflow-hidden"
      role="img"
      aria-label="Demonstration: a paste of customer records into ChatGPT is classified as CUSTOMER_PII with 0.94 confidence, matched against policy AI-PROTECTION-001, and blocked in 14 milliseconds."
    >
      {/* chrome */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#343B50] bg-[#05060A]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded-[5px] flex items-center justify-center flex-none bg-[rgba(76,142,255,.14)] ring-1 ring-inset ring-[rgba(76,142,255,.32)]">
            <Mark size={12} tone="#4C8EFF" />
          </span>
          <span className="mono text-[10px] tracking-[0.11em] uppercase text-[#7E8798] truncate">
            securedesk · extension
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4C8EFF] animate-pulse-dot" />
          <span className="mono text-[10px] tracking-[0.09em] uppercase text-[#4C8EFF]">
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
              <span className="mono text-[10.5px] text-[#7E8798] pt-px tabular-nums flex-none w-[42px]">
                {row.t}
              </span>
              <span
                className="mt-[7px] w-1 h-1 rounded-full flex-none transition-colors duration-300"
                style={{ background: on ? (last ? "#FF8078" : "#4C8EFF") : "#7E8798" }}
              />
              <div className="min-w-0 flex-1">
                <div
                  className="mono text-[11px] tracking-[0.06em] uppercase transition-colors duration-300"
                  style={{ color: on ? (last ? "#FF8078" : "#C6CCD9") : "#7E8798" }}
                >
                  {row.label}
                </div>
                <div className="text-[12.5px] text-[#99A1B3] mt-0.5 truncate">
                  {row.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* what the employee sees */}
      <div className="border-t border-[#343B50] p-3.5">
        <div
          className="rounded-md border p-3.5 transition-all duration-500"
          style={{
            borderColor: done ? "rgba(242,122,110,.34)" : "#343B50",
            background: done ? "rgba(242,122,110,.07)" : "#05060A",
            opacity: done ? 1 : 0.3,
          }}
        >
          <div className="flex items-start gap-2.5">
            <Mark size={15} tone={done ? "#FF8078" : "#7E8798"} />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#EEF1F7] leading-snug">
                SecureDesk blocked this paste
              </p>
              <p className="text-[12px] text-[#99A1B3] mt-1 leading-relaxed">
                It looks like customer personal information. Your organisation's
                policy doesn't allow that in external AI tools.
              </p>
              <p className="mono text-[10px] tracking-[0.08em] uppercase text-[#7E8798] mt-2">
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

              <p className="mt-5 mono text-[11px] tracking-[0.06em] text-slate-500">
                No card required · Deploys to Chrome and Edge in minutes
              </p>
            </div>

            {/* the demo */}
            <div className="lg:pl-2 relative">
              {/* ambient glow so the dark panel reads as lit, not a flat
                  cutout dropped onto the white hero */}
              <div
                className="absolute -inset-6 -z-10 opacity-60 blur-3xl pointer-events-none"
                style={{
                  background:
                    "radial-gradient(60% 60% at 50% 38%, rgba(76,142,255,.22), transparent 72%)",
                }}
              />
              <InterceptPanel />
              <p className="mt-3 mono text-[10.5px] tracking-[0.07em] uppercase text-slate-500 text-center">
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
                <span className="mono text-[12px] text-slate-500 tabular-nums pt-0.5 group-hover:text-signal-ink transition-colors">
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
                    <Minus className="w-3.5 h-3.5 text-slate-500 mt-1 flex-none" strokeWidth={2.5} />
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

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="tokens-dark bg-ink text-slate-100">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-narrow">
            <p className="eyebrow eyebrow-accent mb-5" style={{ color: "#4C8EFF" }}>
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
              <Link to="/register" className="btn !bg-signal-bright !text-[#06121F] hover:!bg-[#7FADFF] !px-5 !py-2.5">
                Create your workspace
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="mailto:sanskar@securedesk.in"
                className="btn !border-[#454D63] !text-slate-200 border hover:!bg-[#12151F] !px-5 !py-2.5"
              >
                Talk to the team
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="tokens-dark bg-ink border-t border-[#343B50] text-slate-400">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="text-slate-300">
              <Wordmark size={19} />
            </div>
            <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[13px]">
              <Link to="/login" className="hover:text-slate-200 transition-colors">Sign in</Link>
              <a href="mailto:sanskar@securedesk.in" className="hover:text-slate-200 transition-colors">Contact</a>
            </nav>
          </div>
          <div className="rule !bg-[#343B50] my-7" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="mono text-[11px] tracking-[0.06em] text-slate-400">
              © {new Date().getFullYear()} SecureDesk · securedesk.in
            </p>
            <p className="mono text-[11px] tracking-[0.06em] text-slate-400">
              Browser data protection for Chrome and Edge
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
