/**
 * SecureDesk — WhatsApp Web interception (Phase 3 rewrite).
 *
 * This is the product. Everything else (background.js, popup) exists to
 * support what happens in this file: a file is about to leave the browser
 * via WhatsApp Web, and it must be scanned and cleared BEFORE WhatsApp's
 * own handlers ever see it — not scanned after the fact with a dismissible
 * warning, which is what the extension did before this rewrite.
 *
 * How blocking actually works: capture-phase listeners on `document` run
 * before any listener WhatsApp attached directly to the input/drop target
 * (capture fires outer-to-inner, before bubble-phase listeners on the
 * target itself — see MDN's event-flow diagram). stopImmediatePropagation
 * + preventDefault in that capture-phase handler stops the event dead:
 * WhatsApp's own change/drop/paste handler never runs, so the file is
 * never handed to WhatsApp's send pipeline. Only after a scan comes back
 * ALLOW (or the user explicitly clicks "Send Anyway" on a WARN) do we
 * synthesize a new event carrying the same File object and dispatch it —
 * see release().
 *
 * Fail-to-warn, never fail-open: any scan failure (offline, timeout,
 * not-enrolled, revoked token, server error) shows the WARN modal with an
 * "unverified" reason, never silently lets the file through and never
 * escalates a mere connectivity failure to a hard BLOCK either.
 */
(function () {
  "use strict";

  // Idempotent — WhatsApp Web is a long-lived SPA; this script should
  // never run twice in the same page even if Chrome re-injects it.
  if (window.__SD_CONTENT_INJECTED__) return;
  window.__SD_CONTENT_INJECTED__ = true;

  const EXT_VERSION = chrome.runtime.getManifest().version;

  // ── Design tokens — match the web app exactly ──────────────────────
  const T = {
    bg: "#0A0A0C", surface: "#141418", border: "#26262C",
    text: "#F5F5F7", textMuted: "#8A8A94",
    success: "#22C55E", warn: "#F59E0B", error: "#DC143C", brand: "#DC143C",
    font: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  };

  // ── Shadow DOM isolation — WhatsApp's CSS never reaches this ───────
  let shadow = null;

  function ensureShadow() {
    if (shadow) return shadow;
    const host = document.createElement("securedesk-root");
    // `all:initial` strips any inherited WhatsApp styling from the host
    // element itself before the shadow boundary even applies.
    host.style.cssText =
      "all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;";
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    return shadow;
  }

  const CSS = `
    * { box-sizing: border-box; }
    .sd-overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(10,10,12,0.72); backdrop-filter: blur(6px);
      font-family: ${T.font}; animation: sd-fade .15s ease;
    }
    @keyframes sd-fade { from { opacity: 0 } to { opacity: 1 } }
    .sd-card {
      width: 380px; max-width: calc(100vw - 32px);
      background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 8px;
      padding: 20px; color: ${T.text};
      box-shadow: 0 25px 60px rgba(0,0,0,.55);
      animation: sd-up .2s ease;
    }
    @keyframes sd-up { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform: translateY(0) } }
    .sd-head { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
    .sd-logo {
      width:30px; height:30px; border-radius:8px; flex-shrink:0;
      background:${T.brand}; display:flex; align-items:center; justify-content:center; font-size:15px;
    }
    .sd-title { font-weight:700; font-size:14px; line-height:1.3; }
    .sd-sub { font-size:11px; color:${T.textMuted}; margin-top:2px; word-break:break-all; }
    .sd-badge {
      display:inline-flex; align-items:center; gap:6px; padding:5px 14px; border-radius:20px;
      font-size:12px; font-weight:700; margin:4px 0 12px;
    }
    .sd-badge.block { background:rgba(220,20,60,.15); color:#ff8fa3; border:1px solid ${T.error}; }
    .sd-badge.warn  { background:rgba(245,158,11,.15); color:#fcd34d; border:1px solid ${T.warn}; }
    .sd-badge.allow { background:rgba(34,197,94,.15); color:#86efac; border:1px solid ${T.success}; }
    .sd-reasons { list-style:none; padding:0; margin:0 0 14px; }
    .sd-reasons li {
      font-size:12.5px; color:${T.text}; line-height:1.5; padding:7px 0;
      border-bottom:1px solid ${T.border};
    }
    .sd-reasons li:last-child { border-bottom:none; }
    .sd-note { font-size:11.5px; color:${T.textMuted}; line-height:1.5; margin:0 0 14px; }
    .sd-row { display:flex; gap:8px; margin-top:6px; }
    .sd-btn {
      flex:1; padding:10px; border-radius:6px; border:1px solid transparent;
      font-size:13px; font-weight:600; cursor:pointer; font-family:${T.font};
      transition: filter .1s ease;
    }
    .sd-btn:hover { filter: brightness(1.12); }
    .sd-btn:active { filter: brightness(0.92); }
    .sd-btn.primary { background:${T.brand}; color:#fff; }
    .sd-btn.warn-primary { background:${T.warn}; color:#1a1300; }
    .sd-btn.ghost { background:transparent; color:${T.textMuted}; border-color:${T.border}; }
    .sd-btn:disabled { opacity:.5; cursor:not-allowed; }
    .sd-spin {
      width:28px; height:28px; border:3px solid ${T.border}; border-top-color:${T.brand};
      border-radius:50%; animation: sd-spin .8s linear infinite; margin:6px auto 14px;
    }
    @keyframes sd-spin { to { transform: rotate(360deg) } }
    .sd-scan-body { text-align:center; }
    .sd-scan-title { font-size:13px; font-weight:600; margin-bottom:4px; }
    .sd-scan-sub { font-size:11.5px; color:${T.textMuted}; line-height:1.5; }
    .sd-textarea {
      width:100%; min-height:64px; resize:vertical; margin-top:8px; margin-bottom:10px;
      background:${T.bg}; border:1px solid ${T.border}; border-radius:6px; color:${T.text};
      font-family:${T.font}; font-size:12.5px; padding:8px; outline:none;
    }
    .sd-textarea:focus { border-color:${T.brand}; }
    .sd-toast {
      position:fixed; bottom:20px; right:20px; z-index:2147483647;
      background:${T.surface}; border:1px solid ${T.border}; border-left:3px solid ${T.success};
      border-radius:8px; padding:10px 16px; color:${T.text}; font-family:${T.font};
      font-size:12.5px; font-weight:600; box-shadow:0 12px 30px rgba(0,0,0,.5);
      animation: sd-toast-in .2s ease, sd-toast-out .25s ease 1.75s forwards;
    }
    @keyframes sd-toast-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes sd-toast-out { to { opacity:0; transform:translateY(8px) } }
    .sd-hint { font-size:10.5px; color:${T.textMuted}; margin-top:10px; text-align:center; }
  `;

  // ── Overlay plumbing (one at a time; the newest replaces the last) ──
  let overlayEl = null;
  function clearOverlay() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }
  function showOverlay(cardNode, { dismissible = false } = {}) {
    clearOverlay();
    const root = ensureShadow();
    overlayEl = document.createElement("div");
    overlayEl.className = "sd-overlay";
    overlayEl.appendChild(cardNode);
    if (dismissible) {
      overlayEl.addEventListener("click", (e) => { if (e.target === overlayEl) clearOverlay(); });
    }
    // Escape never closes anything here, deliberately — a BLOCK/WARN
    // decision is dismissed only by an explicit button click (or the
    // scanning overlay, which cannot be dismissed at all). Swallowing
    // Escape while our overlay is open also stops WhatsApp's own Escape
    // handler (e.g. closing an attachment picker mid-flow) from firing
    // underneath it.
    overlayEl.tabIndex = -1;
    root.appendChild(overlayEl);
    overlayEl.focus();
  }
  document.addEventListener("keydown", (e) => {
    if (overlayEl && e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);

  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function showToast(text, kind = "success") {
    const root = ensureShadow();
    const el = document.createElement("div");
    el.className = "sd-toast";
    el.style.borderLeftColor = kind === "success" ? T.success : T.warn;
    el.textContent = text;
    root.appendChild(el);
    setTimeout(() => el.remove(), 2100);
  }

  // ── Card builders ────────────────────────────────────────────────

  function head(subtitle) {
    const d = document.createElement("div");
    d.className = "sd-head";
    d.innerHTML = `
      <div class="sd-logo">🛡️</div>
      <div>
        <div class="sd-title">SecureDesk</div>
        <div class="sd-sub">${esc(subtitle)}</div>
      </div>`;
    return d;
  }

  function buildScanningCard(filename) {
    const card = document.createElement("div");
    card.className = "sd-card";
    card.appendChild(head(filename));
    const body = document.createElement("div");
    body.className = "sd-scan-body";
    body.innerHTML = `
      <div class="sd-spin"></div>
      <div class="sd-scan-title">Scanning document…</div>
      <div class="sd-scan-sub">This file is being checked for sensitive personal
        data before it can be sent.</div>`;
    card.appendChild(body);
    return card;
  }

  function reasonsList(reasons) {
    const ul = document.createElement("ul");
    ul.className = "sd-reasons";
    const items = (reasons && reasons.length) ? reasons : ["No specific reason returned."];
    for (const r of items.slice(0, 5)) {
      const li = document.createElement("li");
      li.textContent = r; // textContent only — never innerHTML with server text
      ul.appendChild(li);
    }
    return ul;
  }

  function buildBlockCard({ filename, reasons, onOverride, onClose }) {
    const card = document.createElement("div");
    card.className = "sd-card";
    card.appendChild(head(filename));

    const badge = document.createElement("div");
    badge.className = "sd-badge block";
    badge.textContent = "🚫 File Blocked";
    card.appendChild(badge);

    card.appendChild(reasonsList(reasons));

    const note = document.createElement("p");
    note.className = "sd-note";
    note.textContent = "This decision has been logged to your organisation's compliance record.";
    card.appendChild(note);

    // Override request: a text field + submit, collapsed until asked for.
    const overridePanel = document.createElement("div");
    overridePanel.style.display = "none";
    const textarea = document.createElement("textarea");
    textarea.className = "sd-textarea";
    textarea.placeholder = "Why does this need to be sent? (visible to your admin)";
    textarea.maxLength = 500;
    const submitRow = document.createElement("div");
    submitRow.className = "sd-row";
    const submitBtn = document.createElement("button");
    submitBtn.className = "sd-btn primary"; submitBtn.textContent = "Submit Request";
    const cancelOverrideBtn = document.createElement("button");
    cancelOverrideBtn.className = "sd-btn ghost"; cancelOverrideBtn.textContent = "Back";
    submitRow.append(cancelOverrideBtn, submitBtn);
    overridePanel.append(textarea, submitRow);
    card.appendChild(overridePanel);

    const mainRow = document.createElement("div");
    mainRow.className = "sd-row";
    const overrideBtn = document.createElement("button");
    overrideBtn.className = "sd-btn ghost"; overrideBtn.textContent = "Request Override";
    const closeBtn = document.createElement("button");
    closeBtn.className = "sd-btn primary"; closeBtn.textContent = "Close";
    mainRow.append(overrideBtn, closeBtn);
    card.appendChild(mainRow);

    overrideBtn.addEventListener("click", () => {
      mainRow.style.display = "none";
      overridePanel.style.display = "block";
      textarea.focus();
    });
    cancelOverrideBtn.addEventListener("click", () => {
      overridePanel.style.display = "none";
      mainRow.style.display = "flex";
    });
    submitBtn.addEventListener("click", async () => {
      const reason = textarea.value.trim();
      if (!reason) { textarea.focus(); return; }
      submitBtn.disabled = true; submitBtn.textContent = "Submitting…";
      const ok = await onOverride(reason);
      submitBtn.disabled = false;
      if (ok) {
        overridePanel.innerHTML =
          `<p class="sd-note" style="color:${T.success}">Your request has been recorded and is
           visible to your administrator. The file was <strong>not</strong> sent.</p>`;
      } else {
        submitBtn.textContent = "Submit Request";
        overridePanel.appendChild(Object.assign(document.createElement("p"), {
          className: "sd-note", style: `color:${T.error}`,
          textContent: "Couldn't record the request — try again in a moment.",
        }));
      }
    });
    closeBtn.addEventListener("click", onClose);

    return card;
  }

  function buildWarnCard({ filename, reasons, unverified, onSend, onCancel }) {
    const card = document.createElement("div");
    card.className = "sd-card";
    card.appendChild(head(filename));

    const badge = document.createElement("div");
    badge.className = "sd-badge warn";
    badge.textContent = unverified ? "⚠️ Unverified — review before sending" : "⚠️ Review Carefully";
    card.appendChild(badge);

    card.appendChild(reasonsList(reasons));

    const row = document.createElement("div");
    row.className = "sd-row";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "sd-btn ghost"; cancelBtn.textContent = "Cancel";
    const sendBtn = document.createElement("button");
    sendBtn.className = "sd-btn warn-primary"; sendBtn.textContent = "Send Anyway";
    row.append(cancelBtn, sendBtn);
    card.appendChild(row);

    cancelBtn.addEventListener("click", onCancel);
    sendBtn.addEventListener("click", onSend);

    return card;
  }

  // ── Messaging to the background service worker ─────────────────────

  function sendMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ error: "extension_context", message: chrome.runtime.lastError.message });
            return;
          }
          resolve(resp || { error: "empty_response" });
        });
      } catch (e) {
        resolve({ error: "extension_context", message: e.message });
      }
    });
  }

  async function scanFileViaBackground(file) {
    const buffer = await file.arrayBuffer();
    // Sent as a plain object (name/type/size/buffer) rather than the File
    // itself — chrome.runtime.sendMessage structured-clones ArrayBuffer
    // reliably; File/Blob support has historically been inconsistent
    // across Chrome versions, so this sidesteps that entirely.
    return sendMessage({
      type: "SCAN_FILE",
      file: { name: file.name, type: file.type || "application/octet-stream", size: file.size, buffer },
    });
  }

  function scanErrorMessage(result) {
    switch (result && result.error) {
      case "not_enrolled": return "This device isn't enrolled with SecureDesk — file not verified. Open the extension icon to enrol.";
      case "token_revoked": return "This device's enrollment was revoked — file not verified. Re-enrol from the extension icon.";
      case "offline":
      case "network":       return "SecureDesk backend is unreachable — file not verified. It has been queued and you'll be notified once it's checked.";
      case "timeout":       return "The scan took too long to complete — file not verified.";
      default:               return "This file could not be verified. Sending is not recommended.";
    }
  }

  // ── Interception ─────────────────────────────────────────────────

  // Briefly disabled around our own synthetic re-dispatch so we don't
  // intercept the very event we just created to release a cleared file.
  let interceptionEnabled = true;
  let interceptionHealthy = true;
  let lastScanAt = null;

  function fileFromEvent(e) {
    if (e.type === "change") {
      const el = e.target;
      if (el && el.tagName === "INPUT" && el.type === "file" && el.files && el.files.length) {
        return { file: el.files[0], ctx: { kind: "input", input: el } };
      }
    } else if (e.type === "drop") {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        return { file: e.dataTransfer.files[0], ctx: { kind: "drop", target: e.target } };
      }
    } else if (e.type === "paste") {
      const items = e.clipboardData && e.clipboardData.items;
      if (items) {
        for (const item of items) {
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) return { file, ctx: { kind: "paste", target: e.target } };
          }
        }
      }
    }
    return null;
  }

  async function onPotentialFileEvent(e) {
    if (!interceptionEnabled) return;
    const found = fileFromEvent(e);
    if (!found) return;

    // This is the critical line: stop WhatsApp from ever seeing the
    // original event. Capture-phase + stopImmediatePropagation means no
    // other listener on this event — including ones WhatsApp attached
    // directly to the input/drop target — runs at all.
    e.stopImmediatePropagation();
    e.preventDefault();

    await processFile(found.file, found.ctx);
  }

  document.addEventListener("change", onPotentialFileEvent, true);
  document.addEventListener("drop", onPotentialFileEvent, true);
  document.addEventListener("paste", onPotentialFileEvent, true);
  // WhatsApp Web also needs its OWN drop targets to not treat dragover as
  // "nothing is happening" — we don't intercept dragover/dragenter, only
  // the terminal drop event, which is enough to stop the file transfer.

  const SCAN_TIMEOUT_MS = 20000;

  async function processFile(file, ctx) {
    if (!file) return;
    showOverlay(buildScanningCard(file.name));

    const scanPromise = scanFileViaBackground(file);
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ error: "timeout" }), SCAN_TIMEOUT_MS + 500) // background applies its own 20s timeout; this is a backstop
    );
    const result = await Promise.race([scanPromise, timeoutPromise]);

    lastScanAt = new Date().toISOString();
    interceptionHealthy = true;
    sendMessage({ type: "SCAN_COMPLETED", verdict: result, filename: file.name });

    if (result && result.error) {
      interceptionHealthy = result.error !== "extension_context";
      showOverlay(buildWarnCard({
        filename: file.name,
        reasons: [scanErrorMessage(result)],
        unverified: true,
        onSend: () => { clearOverlay(); release(file, ctx); },
        onCancel: () => clearOverlay(),
      }));
      return;
    }

    const action = String(result.recommended_action || result.action || "WARN").toUpperCase();

    if (action === "ALLOW") {
      clearOverlay();
      release(file, ctx);
      showToast(`✓ ${file.name} cleared`, "success");
      return;
    }

    if (action === "WARN") {
      showOverlay(buildWarnCard({
        filename: file.name,
        reasons: result.reasons,
        onSend: () => { clearOverlay(); release(file, ctx); },
        onCancel: () => clearOverlay(),
      }));
      return;
    }

    // BLOCK — and the fail-safe default for any unrecognised action value.
    // Escalation-only applies to the backend's scoring, not to how this
    // client interprets an action string it doesn't recognise: an unknown
    // value is treated as the strictest case, never as ALLOW.
    showOverlay(buildBlockCard({
      filename: file.name,
      reasons: result.reasons,
      onOverride: (reasonText) => submitOverride({
        fileHash: result.file_hash || "", filename: file.name, reason: reasonText,
      }),
      onClose: () => clearOverlay(),
    }));
  }

  async function submitOverride({ fileHash, filename, reason }) {
    const resp = await sendMessage({ type: "OVERRIDE_REQUEST", fileHash, filename, reason });
    return !!(resp && resp.recorded);
  }

  function release(file, ctx) {
    interceptionEnabled = false;
    try {
      if (ctx.kind === "input" && ctx.input && ctx.input.isConnected) {
        const dt = new DataTransfer();
        dt.items.add(file);
        ctx.input.files = dt.files;
        ctx.input.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (ctx.kind === "drop" && ctx.target) {
        const dt = new DataTransfer();
        dt.items.add(file);
        ctx.target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      } else if (ctx.kind === "paste" && ctx.target) {
        // Best-effort: synthetic ClipboardEvent.clipboardData is read-only
        // in most engines, so this doesn't always reproduce a real paste.
        // Documented limitation — see PHASE 3 deliverable notes.
        try {
          const dt = new DataTransfer();
          dt.items.add(file);
          const evt = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
          Object.defineProperty(evt, "clipboardData", { value: dt });
          ctx.target.dispatchEvent(evt);
        } catch (err) {
          console.warn("[SecureDesk] Could not automatically re-send a pasted file; ask the user to paste again.", err);
          showToast("Paste again to send — couldn't auto-release", "warn");
        }
      }
    } finally {
      // Re-enabled on the next tick, after our own synthetic event has
      // finished propagating through the (now un-intercepted) chain.
      setTimeout(() => { interceptionEnabled = true; }, 50);
    }
  }

  // ── Self-test + health reporting ────────────────────────────────────

  async function selfTest() {
    const resp = await sendMessage({ type: "PING_BACKEND" });
    interceptionHealthy = !!(resp && resp.reachable);
    sendMessage({
      type: "SELF_TEST_RESULT",
      healthy: interceptionHealthy,
      listenersAttached: true,
      extensionVersion: EXT_VERSION,
    });
  }
  selfTest();

  // Background asks content.js for a live status snapshot (used by the
  // popup's diagnostics panel while this tab is open).
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "GET_CONTENT_STATUS") {
      sendResponse({
        interceptionHealthy, lastScanAt,
        url: location.href, extensionVersion: EXT_VERSION,
      });
      return true;
    }
    return false;
  });
})();
