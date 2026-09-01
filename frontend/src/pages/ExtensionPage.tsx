import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Chrome, Minus, ShieldCheck } from "lucide-react";
import { Wordmark } from "../components/Mark";
import BlockModalPreview from "../components/BlockModalPreview";
import useMarketingSurface from "../hooks/useMarketingSurface";

const EXTENSION_DOWNLOAD_URL = "/extension.zip";

const SEES: { label: string; sees: boolean }[] = [
  { label: "A file attached, dropped, or pasted on web.whatsapp.com", sees: true },
  { label: "That file's bytes, sent to SecureDesk for scanning", sees: true },
  { label: "The scan verdict, shown before the file is allowed to send", sees: true },
  { label: "Which device/employee a scan came from (for the audit trail)", sees: true },
  { label: "Any other website, tab, or app", sees: false },
  { label: "WhatsApp message text — typed chat content itself", sees: false },
  { label: "Files that were never attached to a WhatsApp message", sees: false },
  { label: "Keystrokes, browsing history, or screenshots", sees: false },
  { label: "Personal WhatsApp accounts on a personal, unenrolled device", sees: false },
];

const FAQ: [string, string][] = [
  [
    "Does it slow down WhatsApp Web?",
    "A scan typically completes in a few seconds. The file is held — not sent — until a verdict comes back, so there is a brief pause on every attachment, not a background delay you'd otherwise not notice.",
  ],
  [
    "What happens if the SecureDesk backend is unreachable?",
    "The extension fails to WARN, never to ALLOW: an unverifiable file is flagged as unverified and the employee decides whether to proceed, rather than being silently blocked or silently let through.",
  ],
  [
    "Can an employee just disable or uninstall it?",
    "Chrome policy (via Google Workspace, GPO, or MDM — see the deploy tabs above) can force-install and lock the extension so it can't be removed from the toolbar. Enrollment itself is revoked from the admin console, not from the extension.",
  ],
  [
    "Does IT see the content of my personal chats?",
    "No — only files attached to a WhatsApp message are inspected, and only their scan result (categories, risk level, decision) is logged, never the message text around them. See the transparency table above.",
  ],
  [
    "Does this work on WhatsApp Desktop or mobile?",
    "No. This is a Chrome (and Chromium-based Edge) extension scoped to web.whatsapp.com only — it does not run on the native desktop app or on phones.",
  ],
];

function DeployTab({ active, title, children }: { active: boolean; title: string; children: React.ReactNode }) {
  if (!active) return null;
  return (
    <div>
      <h3 className="text-[15px] font-semibold text-slate-900 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mono text-[11px] text-slate-500 tabular-nums flex-none w-5 pt-0.5">{n}.</span>
      <p className="text-[13.5px] leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}

export default function ExtensionPage() {
  useMarketingSurface();
  const [tab, setTab] = useState<"workspace" | "gpo" | "macos">("workspace");

  return (
    <div className="tokens-light min-h-screen bg-paper text-slate-900 antialiased">
      <header className="sticky top-0 z-50 bg-paper/85 backdrop-blur-md border-b border-paper-line">
        <div className="max-w-shell mx-auto px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <Link to="/" className="text-slate-900 hover:opacity-70 transition-opacity">
            <Wordmark size={21} />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex text-[13.5px] text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors">
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

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-paper-line">
        <div className="max-w-shell mx-auto px-6 lg:px-8 pt-14 pb-16 lg:pt-20 lg:pb-20">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-14 items-center">
            <div>
              <p className="eyebrow mb-4">Chrome extension</p>
              <h1 className="text-display-lg text-slate-950 max-w-[18ch]">
                Stops a sensitive file before it leaves WhatsApp Web.
              </h1>
              <p className="mt-6 text-[16px] leading-relaxed text-slate-600 max-w-[52ch]">
                SecureDesk for Chrome intercepts every file an employee attaches, drags,
                or pastes into WhatsApp Web, scans it against your policy — including
                photographed ID documents — and only lets it through on a clean result.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={EXTENSION_DOWNLOAD_URL}
                  download="securedesk-extension.zip"
                  className="btn btn-primary !bg-slate-900 !text-paper hover:!bg-slate-800 !px-5 !py-2.5"
                >
                  <Chrome className="w-4 h-4" />
                  Download Extension
                </a>
                <Link to="/admin/devices" className="btn btn-secondary !border-paper-line2 !text-slate-700 hover:!bg-paper-sunk !px-5 !py-2.5">
                  Generate a device token
                </Link>
              </div>
              <p className="mt-4 mono text-[11px] tracking-[0.06em] text-slate-500">
                Chrome 116+ · Also runs on Chromium-based Edge
              </p>
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

      {/* ── Manual install instructions ───────────────────────── */}
      <section className="border-b border-paper-line bg-paper-raised">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-16 lg:py-20">
          <p className="eyebrow mb-4">Pilot install</p>
          <h2 className="text-display-md text-slate-950 mb-4">Load the extension manually in Chrome.</h2>
          <p className="text-[16px] leading-relaxed text-slate-600 max-w-[60ch] mb-8">
            For early pilots, we distribute the extension as a ZIP bundle and load it as an unpacked extension directly in Chrome. This keeps the rollout controlled while you validate the workflow before broader deployment.
          </p>

          <div className="mb-10 flex flex-wrap items-center gap-3">
            <a
              href={EXTENSION_DOWNLOAD_URL}
              download="securedesk-extension.zip"
              className="btn btn-primary !bg-slate-900 !text-paper hover:!bg-slate-800 !px-5 !py-2.5"
            >
              Download Extension
            </a>
            <a
              href="#install-steps"
              className="btn btn-secondary !border-paper-line2 !text-slate-700 hover:!bg-paper-sunk !px-5 !py-2.5"
            >
              View 4-step guide
            </a>
          </div>

          <div id="install-steps" className="grid gap-6 xl:grid-cols-2">
            {[
              {
                title: "1. Open the Chrome Extensions page",
                text: "In Chrome, visit chrome://extensions. This is the page where you manage installed extensions and the hidden developer tools for unpacked installs.",
                image: "/screenshots/install-step-1.svg",
                alt: "Screenshot of the Chrome Extensions page with the URL chrome://extensions displayed and the toolbar at the top of the browser visible.",
              },
              {
                title: "2. Turn on Developer mode",
                text: "Toggle Developer mode in the top-right corner. This reveals the Load unpacked button and lets Chrome accept a local extension without publishing it to the Chrome Web Store.",
                image: "/screenshots/install-step-2.svg",
                alt: "Screenshot of the Chrome Extensions page with Developer mode enabled and the Load unpacked button visible under the extensions list.",
              },
              {
                title: "3. Load the downloaded ZIP contents",
                text: "Click Load unpacked, then choose the extracted extension folder that came from the ZIP. Do not select the ZIP archive itself; select the folder that contains the manifest and assets.",
                image: "/screenshots/install-step-3.svg",
                alt: "Screenshot of the file picker dialog open to a downloaded securedesk extension folder with the manifest.json file visible.",
              },
              {
                title: "4. Confirm the extension is installed and pinned",
                text: "Chrome finishes installing the extension. Pin it to the toolbar if you want employees to see it easily, and confirm the SecureDesk icon appears in the browser extension tray.",
                image: "/screenshots/install-step-4.svg",
                alt: "Screenshot of the installed extension card in Chrome with the SecureDesk icon pinned in the toolbar and the extension list showing it as enabled.",
              },
            ].map((step) => (
              <div key={step.title} className="bg-paper border border-paper-line rounded-lg p-4 shadow-sm">
                <h3 className="text-[15px] font-semibold text-slate-900 mb-3">{step.title}</h3>
                <img
                  src={step.image}
                  alt={step.alt}
                  className="w-full h-auto rounded border border-paper-line bg-paper-sunk mb-3"
                />
                <p className="text-[13.5px] leading-relaxed text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Deploy instructions ─────────────────────────────────── */}
      <section className="border-b border-paper-line bg-paper-raised">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-16 lg:py-20">
          <p className="eyebrow mb-4">Deployment</p>
          <h2 className="text-display-md text-slate-950 mb-8">Roll it out fleet-wide, not one install at a time.</h2>

          <div className="flex gap-1.5 mb-6 border-b border-paper-line">
            {([
              ["workspace", "Google Workspace"],
              ["gpo", "Windows GPO"],
              ["macos", "macOS (MDM)"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px transition-colors ${
                  tab === id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-paper-raised border border-paper-line rounded-lg p-6 max-w-[640px]">
            <DeployTab active={tab === "workspace"} title="Google Workspace (Admin console)">
              <Step n={1}>
                Publish or upload the extension as <strong>Unlisted</strong> in the Chrome Web Store
                Developer Dashboard, and note its extension ID.
              </Step>
              <Step n={2}>
                In the Admin console, go to <strong>Devices → Chrome → Apps &amp; extensions → Users &amp; browsers</strong>.
              </Step>
              <Step n={3}>
                Select the org unit to deploy to, add the extension by ID, and set the install
                policy to <strong>Force install</strong>.
              </Step>
              <Step n={4}>
                Optionally pin it and disallow removal so employees can't uninstall or disable it.
              </Step>
              <Step n={5}>
                It appears automatically the next time each employee's Chrome syncs policy —
                no per-machine action needed.
              </Step>
            </DeployTab>

            <DeployTab active={tab === "gpo"} title="Windows (Group Policy)">
              <Step n={1}>
                Install the <strong>Chrome ADMX templates</strong> from Google if not already present
                on your policy management machine.
              </Step>
              <Step n={2}>
                Open Group Policy Management → edit the GPO scoped to your target OU →{" "}
                <strong>Computer Configuration → Policies → Administrative Templates → Google → Google Chrome → Extensions</strong>.
              </Step>
              <Step n={3}>
                Enable <strong>Configure the list of force-installed apps and extensions</strong> and
                add an entry: <code className="mono text-[12px] bg-paper-sunk px-1.5 py-0.5 rounded">extension-id;update-url</code>.
              </Step>
              <Step n={4}>
                Run <code className="mono text-[12px] bg-paper-sunk px-1.5 py-0.5 rounded">gpupdate /force</code> on a test
                machine, confirm the extension appears in <code className="mono text-[12px] bg-paper-sunk px-1.5 py-0.5 rounded">chrome://extensions</code>, then
                let normal policy refresh roll it out.
              </Step>
            </DeployTab>

            <DeployTab active={tab === "macos"} title="macOS (MDM)">
              <Step n={1}>
                In your MDM (Jamf, Kandji, Mosyle, etc.), create a configuration profile targeting{" "}
                <strong>com.google.Chrome</strong>.
              </Step>
              <Step n={2}>
                Add an <strong>ExtensionInstallForcelist</strong> key containing the extension ID and
                update URL, same value as the Windows GPO tab.
              </Step>
              <Step n={3}>
                Scope the profile to the device or user group that needs SecureDesk, and push it.
              </Step>
              <Step n={4}>
                Chrome picks up the policy on next launch or policy refresh — no employee action
                required, and it can't be removed while the profile is assigned.
              </Step>
            </DeployTab>
          </div>
        </div>
      </section>

      {/* ── Transparency table ──────────────────────────────────── */}
      <section className="border-b border-paper-line">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-16 lg:py-20">
          <p className="eyebrow mb-4">Transparency</p>
          <h2 className="text-display-md text-slate-950 mb-3">What it can and cannot see.</h2>
          <p className="text-[15px] leading-relaxed text-slate-600 max-w-measure mb-10">
            Scoped narrowly on purpose — see the extension's own manifest permissions for the
            enforced version of this list, not just the description.
          </p>
          <div className="border border-paper-line rounded-lg overflow-hidden max-w-[640px]">
            <ul className="divide-y divide-paper-line">
              {SEES.map((s) => (
                <li key={s.label} className="flex items-start gap-3 px-5 py-3.5">
                  {s.sees ? (
                    <Check className="w-3.5 h-3.5 text-signal-ink mt-1 flex-none" strokeWidth={2.5} />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-slate-500 mt-1 flex-none" strokeWidth={2.5} />
                  )}
                  <span className="text-[13.5px] text-slate-700 leading-snug">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Requirements + FAQ ──────────────────────────────────── */}
      <section className="bg-paper-raised">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-14">
            <div>
              <p className="eyebrow mb-4">Requirements</p>
              <h2 className="text-display-md text-slate-950 mb-6">Before you deploy.</h2>
              <ul className="space-y-3">
                {[
                  "Chrome 116+ or a Chromium-based Edge build",
                  "A SecureDesk workspace with at least one admin account",
                  "A device token per employee — generated from Devices in the admin console",
                  "Company WhatsApp Web usage on managed browser profiles",
                ].map((r) => (
                  <li key={r} className="flex items-start gap-3">
                    <ShieldCheck className="w-4 h-4 text-signal-ink mt-0.5 flex-none" />
                    <span className="text-[14px] text-slate-700 leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow mb-4">FAQ</p>
              <div className="divide-y divide-paper-line border-t border-paper-line">
                {FAQ.map(([q, a]) => (
                  <details key={q} className="group py-4">
                    <summary className="text-[14px] font-medium text-slate-900 cursor-pointer list-none flex items-center justify-between gap-3">
                      {q}
                      <span className="text-slate-400 group-open:rotate-45 transition-transform text-[18px] leading-none flex-none">+</span>
                    </summary>
                    <p className="mt-2.5 text-[13.5px] leading-relaxed text-slate-600">{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="tokens-dark bg-ink border-t border-[#343B50] text-slate-400">
        <div className="max-w-shell mx-auto px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="text-slate-300">
              <Wordmark size={19} />
            </div>
            <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[13px]">
              <Link to="/" className="hover:text-slate-200 transition-colors">Home</Link>
              <Link to="/login" className="hover:text-slate-200 transition-colors">Sign in</Link>
              <a href="mailto:sanskar@securedesk.in" className="hover:text-slate-200 transition-colors">Contact</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
