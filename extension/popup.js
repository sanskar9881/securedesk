/**
 * SecureDesk popup — enrollment-based (Phase 4 rewrite).
 *
 * No login form: this popup never collects a user's email/password. It
 * accepts a device token that was already minted by an authenticated
 * human in the web app (POST /api/auth/devices) and pasted in here. See
 * background.js's module docstring for why there's no separate
 * enrollment-key exchange endpoint to call instead.
 *
 * No logout button, deliberately (per the rebuild spec): a DLP extension
 * should not be trivially disengaged by the person it's monitoring.
 * Un-enrollment happens from the admin console (DELETE
 * /api/auth/devices/{id}), which this popup's background.js already
 * reacts to automatically — the next scan attempt gets a 401, and
 * background.js clears local enrollment state itself (see scanFile()).
 */

const $ = (id) => document.getElementById(id);

function sendMessage(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function fmtRelative(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function showMsg(el, text, kind) {
  el.textContent = text;
  el.className = `sd-msg ${kind}`;
}

async function refresh() {
  const state = await sendMessage({ type: "GET_STATE" });
  $("version-text").textContent = `v${state.extensionVersion}`;

  if (!state.enrolled) {
    $("enroll-view").style.display = "block";
    $("dash-view").style.display = "none";
    $("dash-footer").style.display = "none";
    return;
  }

  $("enroll-view").style.display = "none";
  $("dash-view").style.display = "block";
  $("dash-footer").style.display = "block";

  $("device-name").textContent = state.deviceName || "";
  $("scan-count").textContent = state.scanCountToday;
  $("block-count").textContent = state.blockCountToday;
  $("last-scan").textContent = fmtRelative(state.lastScanAt);

  const pill = $("status-pill");
  if (state.interceptionHealthy) {
    pill.className = "sd-pill ok";
    pill.textContent = "✓ Protected";
    $("health-value").textContent = "Good";
    $("health-value").className = "sd-stat-value ok";
  } else {
    pill.className = "sd-pill warn";
    pill.textContent = "⚠ Degraded";
    $("health-value").textContent = "Degraded";
    $("health-value").className = "sd-stat-value warn";
  }

  // Live backend check — GET_STATE reflects the last-known value; ping
  // fresh each time the popup opens since that's cheap and this is
  // exactly when a user wants an up-to-date answer.
  const ping = await sendMessage({ type: "PING_BACKEND" });
  const backendEl = $("backend-value");
  backendEl.textContent = ping.reachable ? "Connected" : "Unreachable";
  backendEl.className = `sd-stat-value ${ping.reachable ? "ok" : "warn"}`;

  $("diag-queue").textContent = state.queuedCount;
  $("diag-offline").textContent = state.offlineIncidents;
  $("diag-heartbeat").textContent = fmtRelative(state.lastHeartbeat);
  $("diag-blob").textContent = JSON.stringify(state, null, 2);
}

$("enroll-btn").addEventListener("click", async () => {
  const token = $("token-input").value.trim();
  const label = $("label-input").value.trim();
  const msgEl = $("enroll-msg");
  if (!token) { showMsg(msgEl, "Paste your device token first.", "err"); return; }

  $("enroll-btn").disabled = true;
  $("enroll-btn").textContent = "Validating…";
  const result = await sendMessage({ type: "ENROLL", token, label });
  $("enroll-btn").disabled = false;
  $("enroll-btn").textContent = "Enrol This Device";

  if (!result.ok) {
    showMsg(msgEl, result.error || "Enrollment failed.", "err");
    return;
  }
  showMsg(msgEl, "Device enrolled successfully.", "ok");
  await refresh();
});

$("open-whatsapp-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://web.whatsapp.com/" });
});

$("diag-toggle").addEventListener("click", () => {
  const panel = $("diag-panel");
  panel.style.display = panel.style.display === "block" ? "none" : "block";
});

$("copy-diag-btn").addEventListener("click", async () => {
  const text = $("diag-blob").textContent;
  try {
    await navigator.clipboard.writeText(text);
    const btn = $("copy-diag-btn");
    const original = btn.textContent;
    btn.textContent = "Copied ✓";
    setTimeout(() => { btn.textContent = original; }, 1500);
  } catch {
    // Clipboard API can be denied in some contexts; the pre element is
    // still selectable/copyable by hand as a fallback.
  }
});

refresh();
