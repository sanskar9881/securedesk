import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Minus, CalendarClock, FileCheck2 } from "lucide-react";
import Mark, { Wordmark } from "../components/Mark";
import BlockModalPreview from "../components/BlockModalPreview";
import useMarketingSurface from "../hooks/useMarketingSurface";

/* ═══════════════════════════════════════════════════════════════
   Live interception panel — the product's core moment, shown.
   An employee attaches a photographed Aadhaar card on WhatsApp Web.
   SecureDesk intercepts it before WhatsApp receives it, scans it
   with the vision model, and blocks it.
   ═══════════════════════════════════════════════════════════════ */

const TRACE = [
  { t: "00.000", label: "file intercepted", detail: "aadhaar_photo.jpg → web.whatsapp.com" },
  { t: "00.410", label: "vision scan", detail: "AADHAAR_CARD · confidence 0.94" },
  { t: "01.180", label: "risk scored", detail: "HIGH · government ID, escalation-only" },
  { t: "01.190", label: "policy matched", detail: "government ID documents — BLOCK" },
  { t: "01.200", label: "action enforced", detail: "BLOCKED — never reached WhatsApp's send queue" },
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
      aria-label="Demonstration: a file attached on WhatsApp Web is identified as an Aadhaar card by SecureDesk's vision scan with 0.94 confidence, scored HIGH risk, matched against a BLOCK policy for government ID documents, and blocked before it reached WhatsApp's send queue."
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
                SecureDesk blocked this file
              </p>
              <p className="text-[12px] text-[#99A1B3] mt-1 leading-relaxed">
                It looks like a photo of an Aadhaar card. Government-issued ID
                photos aren't allowed to leave through WhatsApp Web.
              </p>
              <p className="mono text-[10px] tracking-[0.08em] uppercase text-[#7E8798] mt-2">
                logged to the evidence chain · request an override from the extension
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

const DOCUMENT_TYPES = [
  { group: "Government ID",     items: ["Aadhaar card", "PAN card", "Passport", "Voter ID", "Driving licence"] },
  { group: "Financial",         items: ["Bank cheque", "Bank statement", "Credit / debit card", "Salary slip", "ITR form"] },
  { group: "Sensitive records", items: ["Medical report", "Signed contract", "Screenshot with credentials"] },
  { group: "In plain text",     items: ["PAN and Aadhaar number patterns", "Card and bank account numbers", "Bulk phone numbers and email lists"] },
];

const PIPELINE = [
  { n: "01", h: "Intercept before it sends", p: "A capture-phase listener on WhatsApp Web catches every file attachment, drag-and-drop, and paste before WhatsApp's own code ever receives it — not a warning shown after the fact." },
  { n: "02", h: "Inspect — text and images",  p: "Regex patterns catch PAN, Aadhaar, and card numbers in documents; an AI vision model inspects photographed ID cards, bank cheques, and screenshots the way a person would look at them." },
  { n: "03", h: "Score, escalation-only",     p: "Every signal can only raise the risk score, never lower one another signal already raised — a photographed Aadhaar card can't be waved through because the surrounding text looked clean." },
  { n: "04", h: "Decide — allow, warn, or block", p: "The verdict comes back before the file reaches WhatsApp's send queue. A BLOCK is enforced there, not just flagged afterwards." },
  { n: "05", h: "Log to the evidence chain",  p: "Every decision is hash-linked to the one before it and signed — the audit record DPDP Rule 6 requires, built automatically, not bolted on later." },
];

const NEVER = [
  "Keystrokes, typed messages, or WhatsApp chat text itself",
  "Any website or tab other than web.whatsapp.com",
  "A stored copy of the file — analysed in memory, never written to disk",
  "The matched PAN, Aadhaar, or card digits — only that a match occurred",
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
              to="/extension"
              className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-signal-ink border border-signal-ink/40 hover:border-signal-ink hover:bg-signal-wash px-3.5 py-2 rounded transition-colors"
            >
              Get Extension
            </Link>
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
                <span className="eyebrow">WhatsApp Web data loss prevention</span>
              </div>

              <h1 className="text-display-xl text-slate-950 max-w-[15ch]">
                Sensitive files don't leak.
                <span className="block text-signal-ink">They go out on WhatsApp.</span>
              </h1>

              <p className="mt-7 text-[17px] leading-relaxed text-slate-600 max-w-[52ch]">
                Employees photograph Aadhaar cards, PAN cards, and bank statements and
                send them over WhatsApp Web dozens of times a day — to vendors,
                candidates, and each other, usually without thinking twice. SecureDesk
                intercepts the file before WhatsApp ever receives it, scans it —
                including the photo itself — and blocks what your policy says
                shouldn't go out.
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
                Illustrative trace — the file is held until SecureDesk returns a verdict
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The extension, shown ────────────────────────────────── */}
      <section className="border-b border-paper-line">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-14 items-center">
            <div>
              <p className="eyebrow eyebrow-accent mb-4">The Chrome &amp; Edge extension</p>
              <h2 className="text-display-md text-slate-950">
                This is what an employee actually sees.
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-slate-600 max-w-measure">
                SecureDesk ships as a browser extension for Chrome and Edge. Not a silent log
                entry, and not a dismissible toast — the file is held until a verdict comes
                back, and a BLOCK means the file never reaches the send button. The reason is
                in plain language, never the matched values themselves, and the decision is
                written to your organisation's evidence chain automatically.
              </p>
              <ul className="mt-7 space-y-2.5">
                {[
                  "Held before it sends — not flagged after",
                  "Plain-language reason, never the raw sensitive value",
                  "Logged to the evidence chain the moment it happens",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-signal-ink mt-0.5 flex-none" strokeWidth={2.5} />
                    <span className="text-[13.5px] text-slate-600 leading-snug">{t}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/extension"
                className="inline-flex items-center gap-1.5 mt-7 text-[13.5px] font-medium text-signal-ink border border-signal-ink/40 hover:border-signal-ink hover:bg-signal-wash px-3.5 py-2 rounded transition-colors"
              >
                Get the extension
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div>
              <BlockModalPreview />
              <p className="mt-3 mono text-[10.5px] tracking-[0.07em] uppercase text-slate-500 text-center">
                Illustrative — recreated from the extension's actual block screen
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
                Your existing controls don't watch WhatsApp Web at all.
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-px bg-paper-line border border-paper-line rounded-lg overflow-hidden">
              {[
                { h: "Email DLP", p: "Scans attachments and message bodies on your mail server. A file shared through a browser tab never touches it." },
                { h: "CASB / proxy", p: "Sees that an employee opened web.whatsapp.com. It can't see what's inside the file being attached, let alone whether it's a photographed ID card." },
                { h: "Endpoint DLP", p: "Watches files written to disk. A photo shared straight from WhatsApp Web's file picker often never touches the laptop's disk at all." },
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
              Five stages, from attachment to verdict.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-slate-600 max-w-measure">
              The file is held for the few seconds a scan takes — never sent while a
              decision is pending, and never let through if SecureDesk can't be reached
              to check it.
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
              Every document type DPDP actually cares about.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-slate-600 max-w-measure">
              Detection runs on regex patterns for structured data and an AI vision
              model for photographed documents — the same categories, whether they
              arrive as text or as a picture of the physical card.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-paper-line border border-paper-line rounded-lg overflow-hidden">
            {DOCUMENT_TYPES.map((d) => (
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
                A file is only ever read to answer one question: does this contain
                what your policy says can't go out. It's held in memory for the few
                seconds that takes and never written to disk — SecureDesk has no
                upload folder, no file store, no URL that could ever serve one back.
                What's kept permanently is the verdict — categories detected, a hash,
                the decision — never the matched PAN number, the Aadhaar digits, or a
                copy of the photo itself.
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
                  "Document categories detected, and confidence",
                  "A SHA-256 hash of the file — not the file itself",
                  "The decision — allow, warn, or block — and why, in plain language",
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

      {/* ── DPDP Rule 6 ─────────────────────────────────────────── */}
      <section className="border-b border-paper-line bg-paper-raised">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-12 lg:gap-20">
            <div>
              <p className="eyebrow mb-4">Regulatory deadline</p>
              <h2 className="text-display-md text-slate-950">
                DPDP Rule 6 compliance is due 13 May 2027 — not optional, not far off.
              </h2>
              <div className="mt-6 inline-flex items-center gap-2.5 rounded-lg border border-paper-line2 bg-paper-sunk px-3.5 py-2.5">
                <CalendarClock className="w-4 h-4 text-signal-ink flex-none" />
                <span className="text-[12.5px] font-medium text-slate-800">
                  Reasonable security safeguards must be in place by 13 May 2027
                </span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-px bg-paper-line border border-paper-line rounded-lg overflow-hidden">
              <div className="bg-paper-raised p-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileCheck2 className="w-4 h-4 text-signal-ink" />
                  <p className="eyebrow eyebrow-accent">Rule 6(c) — visibility</p>
                </div>
                <p className="text-[13.5px] leading-relaxed text-slate-600">
                  Data fiduciaries must be able to monitor and review who accessed personal
                  data, and how. SecureDesk's evidence chain <em>is</em> that log — every scan
                  decision, hash-linked and Ed25519-signed, queryable by your admins and
                  verifiable on demand.
                </p>
              </div>
              <div className="bg-paper-raised p-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileCheck2 className="w-4 h-4 text-signal-ink" />
                  <p className="eyebrow eyebrow-accent">Rule 6(e) — retention</p>
                </div>
                <p className="text-[13.5px] leading-relaxed text-slate-600">
                  Logs of personal data processing must be retained for at least one year.
                  Every evidence entry carries its own retention date and the chain is
                  append-only by construction — nothing can edit or shorten it, including us.
                </p>
              </div>
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
              Find out what's already going out on WhatsApp.
            </h2>
            <p className="mt-6 text-[16.5px] leading-relaxed text-slate-300 max-w-measure">
              Deploy the Chrome extension in warn-only mode for two weeks. Nothing gets
              hard-blocked — just an honest picture of what employees are actually
              sending through WhatsApp Web. Then decide what to enforce.
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
