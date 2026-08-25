/**
 * SecureDesk — background service worker (Phase 2 rewrite).
 *
 * All state lives in chrome.storage.local, never in module-scope
 * variables: an MV3 service worker is terminated after ~30s of no
 * activity and restarted on the next event, so anything held only in a
 * `let` at module scope is lost silently between file-send attempts.
 *
 * Backend reality this file is adapted to (see the extension rebuild
 * doc's own corrections, and CONTEXT UPDATE from the backend owner):
 *   - POST /api/dlp/analyze-upload is the multipart, file-bytes endpoint
 *     — NOT /api/dlp/analyze-file, which is JSON/text-only in this
 *     backend. Sending real bytes here is what lets the backend's vision
 *     service actually inspect images (see manifest.json's host_permissions
 *     comment for why cross-origin fetch to the API needs to be listed
 *     there, not just WhatsApp).
 *   - Device tokens (sdt_...) are minted via POST /api/auth/devices by an
 *     authenticated human in the web app — there is no separate
 *     enrollment-key exchange endpoint. "Enrolling" this extension means
 *     pasting that already-minted device_token directly; ENROLL below
 *     validates it with one real (tiny) scan call rather than inventing a
 *     validation endpoint that doesn't exist.
 *   - There is no backend heartbeat-receiving endpoint yet. Heartbeat
 *     stays local-only: a periodic self-test + bookkeeping, surfaced in
 *     the popup's diagnostics panel. Flagged, not silently faked as a
 *     network call that would just 404.
 */

const DEFAULT_API_BASE = "https://securedesk-backend.onrender.com/api";
const SCAN_TIMEOUT_MS = 20000;
const MAX_QUEUE = 500;

const KEYS = {
  deviceToken: "sd_device_token",
  deviceName: "sd_device_name",
  enrolled: "sd_enrolled",
  apiBase: "sd_api_base",
  queue: "sd_queue",
  lastHeartbeat: "sd_last_heartbeat",
  lastSelfTest: "sd_last_self_test",
  interceptionHealthy: "sd_interception_healthy",
  scanCountToday: "sd_scan_count_today",
  blockCountToday: "sd_block_count_today",
  countsDate: "sd_counts_date",
  lastScanAt: "sd_last_scan_at",
  offlineIncidents: "sd_offline_incidents",
};

// ── storage helpers ─────────────────────────────────────────────────

function get(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function set(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

async function apiBase() {
  const { [KEYS.apiBase]: base } = await get([KEYS.apiBase]);
  return (base || DEFAULT_API_BASE).replace(/\/+$/, "");
}

// The API base is stored as ".../api"; /healthz lives at the API root,
// not under /api (see backend main.py — it's mounted directly on the
// FastAPI app, not through any router prefix).
function rootFromApiBase(base) {
  return base.replace(/\/api\/?$/, "");
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function ensureCountsFresh() {
  const { [KEYS.countsDate]: d } = await get([KEYS.countsDate]);
  const today = todayKey();
  if (d !== today) {
    await set({ [KEYS.countsDate]: today, [KEYS.scanCountToday]: 0, [KEYS.blockCountToday]: 0 });
  }
}

// ── alarms: heartbeat (local-only) + queue housekeeping ─────────────

function createAlarms() {
  chrome.alarms.create("sd-heartbeat", { periodInMinutes: 5 });
  chrome.alarms.create("sd-queue-flush", { periodInMinutes: 2 });
}
chrome.runtime.onInstalled.addListener(createAlarms);
chrome.runtime.onStartup.addListener(createAlarms);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sd-heartbeat") heartbeat();
  if (alarm.name === "sd-queue-flush") flushQueue();
});

async function heartbeat() {
  // No backend heartbeat endpoint exists yet (see module docstring) — this
  // is local liveness bookkeeping only: confirm the API is reachable and
  // refresh the badge/diagnostics accordingly. The evidence chain already
  // reserves a "device_heartbeat_lost" event type for real server-side
  // monitoring (see backend services/evidence_service.py) once that
  // endpoint exists.
  const reachable = await pingBackend();
  await set({ [KEYS.lastHeartbeat]: new Date().toISOString() });
  await updateBadge();
  return reachable;
}

async function pingBackend() {
  try {
    const base = await apiBase();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${rootFromApiBase(base)}/healthz`, { signal: controller.signal });
    clearTimeout(t);
    return resp.ok;
  } catch {
    return false;
  }
}

async function flushQueue() {
  const { [KEYS.queue]: queue = [] } = await get([KEYS.queue]);
  if (!queue.length) return;
  const reachable = await pingBackend();
  if (!reachable) return;
  // The file bytes for a queued event are gone by the time we're back
  // online — WhatsApp Web already resolved that send one way or another
  // in the moment (the WARN modal's "unverified, offline" path is what
  // let the user decide then). There is nothing left to re-scan and no
  // backend endpoint to backfill an after-the-fact record against (see
  // module docstring). Flushing here means: stop carrying dead entries
  // once connectivity is confirmed back, while keeping a running count
  // for diagnostics so the history isn't silently lost.
  const { [KEYS.offlineIncidents]: prevCount = 0 } = await get([KEYS.offlineIncidents]);
  await set({ [KEYS.queue]: [], [KEYS.offlineIncidents]: prevCount + queue.length });
}

async function queueOfflineEvent(entry) {
  const { [KEYS.queue]: queue = [] } = await get([KEYS.queue]);
  queue.push(entry);
  if (queue.length > MAX_QUEUE) {
    queue.splice(0, queue.length - MAX_QUEUE);
    queue[0] = { ...queue[0], _dropped_marker: true };
  }
  await set({ [KEYS.queue]: queue });
}

// ── badge (Phase 5) ──────────────────────────────────────────────────

async function updateBadge() {
  const state = await get([
    KEYS.enrolled, KEYS.interceptionHealthy, KEYS.blockCountToday, KEYS.countsDate,
  ]);
  await ensureCountsFresh();
  const fresh = await get([KEYS.blockCountToday]);

  if (!state[KEYS.enrolled]) {
    chrome.action.setBadgeText({ text: "?" });
    chrome.action.setBadgeBackgroundColor({ color: "#8A8A94" });
    return;
  }
  if (state[KEYS.interceptionHealthy] === false) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#F59E0B" });
    return;
  }
  const blocked = fresh[KEYS.blockCountToday] || 0;
  if (blocked > 0) {
    chrome.action.setBadgeText({ text: String(Math.min(blocked, 99)) });
    chrome.action.setBadgeBackgroundColor({ color: "#DC143C" });
    return;
  }
  chrome.action.setBadgeText({ text: "" });
}

// ── scanning ─────────────────────────────────────────────────────────

async function scanFile({ name, type, size, buffer }) {
  const { [KEYS.deviceToken]: token } = await get([KEYS.deviceToken]);
  if (!token) return { error: "not_enrolled" };

  const base = await apiBase();
  const blob = new Blob([buffer], { type: type || "application/octet-stream" });
  const form = new FormData();
  form.append("file", blob, name);
  form.append("use_llm", "true");
  form.append("watermark", "false"); // extension traffic doesn't need a visible watermark applied server-side

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  try {
    const resp = await fetch(`${base}/dlp/analyze-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
    clearTimeout(t);

    if (resp.status === 401) {
      // Device token revoked/expired — un-enrol so the popup reflects
      // reality instead of showing "Protected" for a token that no
      // longer works.
      await set({ [KEYS.enrolled]: false });
      await updateBadge();
      return { error: "token_revoked" };
    }
    if (!resp.ok) return { error: `server_${resp.status}` };
    return await resp.json();
  } catch (e) {
    clearTimeout(t);
    const isAbort = e && e.name === "AbortError";
    await queueOfflineEvent({
      filename: name, size, timestamp: new Date().toISOString(),
      reason: isAbort ? "timeout" : "network",
    });
    return {
      error: isAbort ? "timeout" : "offline",
      action: "WARN", risk_level: "UNKNOWN",
      reasons: ["Backend unreachable — file not verified."],
    };
  }
}

async function submitOverrideRequest({ fileHash, filename, reason }) {
  const { [KEYS.deviceToken]: token } = await get([KEYS.deviceToken]);
  if (!token) return { recorded: false, error: "not_enrolled" };
  const base = await apiBase();
  try {
    const resp = await fetch(`${base}/evidence/override-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ file_hash: fileHash || "", filename, reason }),
    });
    if (!resp.ok) return { recorded: false, error: `server_${resp.status}` };
    return await resp.json();
  } catch (e) {
    return { recorded: false, error: "network", message: e.message };
  }
}

// ── enrollment ───────────────────────────────────────────────────────

async function enrollDevice(rawToken, label) {
  const token = (rawToken || "").trim();
  if (!token.startsWith("sdt_")) {
    return { ok: false, error: "That doesn't look like a SecureDesk device token (should start with sdt_)." };
  }
  const base = await apiBase();
  // No dedicated validation endpoint exists — a tiny real scan is the
  // cheapest honest way to confirm the token actually authenticates and
  // is scoped correctly, using only the endpoint that already exists.
  const form = new FormData();
  form.append("file", new Blob(["SecureDesk enrollment check"], { type: "text/plain" }), "enrollment-check.txt");
  form.append("use_llm", "false");
  form.append("watermark", "false");
  try {
    const resp = await fetch(`${base}/dlp/analyze-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (resp.status === 401) return { ok: false, error: "That device token was rejected — check it was copied in full, or it may have been revoked." };
    if (!resp.ok) return { ok: false, error: `Backend returned an unexpected error (${resp.status}).` };
  } catch (e) {
    return { ok: false, error: "Couldn't reach the SecureDesk backend to validate this token. Check the API URL and your connection." };
  }

  await set({
    [KEYS.deviceToken]: token,
    [KEYS.deviceName]: (label || "This device").trim().slice(0, 100),
    [KEYS.enrolled]: true,
    [KEYS.interceptionHealthy]: true,
  });
  await updateBadge();
  return { ok: true };
}

async function unenroll() {
  await set({ [KEYS.deviceToken]: null, [KEYS.enrolled]: false });
  await updateBadge();
}

// ── message router ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  switch (msg.type) {
    case "SCAN_FILE":
      scanFile(msg.file).then(sendResponse);
      return true;

    case "OVERRIDE_REQUEST":
      submitOverrideRequest(msg).then(sendResponse);
      return true;

    case "SCAN_COMPLETED":
      (async () => {
        await ensureCountsFresh();
        const s = await get([KEYS.scanCountToday, KEYS.blockCountToday]);
        const action = String(
          (msg.verdict && (msg.verdict.recommended_action || msg.verdict.action)) || ""
        ).toUpperCase();
        const updates = {
          [KEYS.scanCountToday]: (s[KEYS.scanCountToday] || 0) + 1,
          [KEYS.lastScanAt]: new Date().toISOString(),
        };
        if (action === "BLOCK") updates[KEYS.blockCountToday] = (s[KEYS.blockCountToday] || 0) + 1;
        await set(updates);
        await updateBadge();
        sendResponse({ ok: true });
      })();
      return true;

    case "SELF_TEST_RESULT":
      (async () => {
        await set({
          [KEYS.interceptionHealthy]: !!msg.healthy,
          [KEYS.lastSelfTest]: new Date().toISOString(),
        });
        await updateBadge();
        sendResponse({ ok: true });
      })();
      return true;

    case "PING_BACKEND":
      pingBackend().then((reachable) => sendResponse({ reachable }));
      return true;

    case "ENROLL":
      enrollDevice(msg.token, msg.label).then(sendResponse);
      return true;

    case "UNENROLL":
      unenroll().then(() => sendResponse({ ok: true }));
      return true;

    case "GET_STATE":
      (async () => {
        await ensureCountsFresh();
        const s = await get([
          KEYS.enrolled, KEYS.deviceName, KEYS.apiBase, KEYS.interceptionHealthy,
          KEYS.scanCountToday, KEYS.blockCountToday, KEYS.lastScanAt,
          KEYS.lastHeartbeat, KEYS.queue, KEYS.offlineIncidents,
        ]);
        sendResponse({
          enrolled: !!s[KEYS.enrolled],
          deviceName: s[KEYS.deviceName] || "",
          apiBase: s[KEYS.apiBase] || DEFAULT_API_BASE,
          interceptionHealthy: s[KEYS.interceptionHealthy] !== false,
          scanCountToday: s[KEYS.scanCountToday] || 0,
          blockCountToday: s[KEYS.blockCountToday] || 0,
          lastScanAt: s[KEYS.lastScanAt] || null,
          lastHeartbeat: s[KEYS.lastHeartbeat] || null,
          queuedCount: (s[KEYS.queue] || []).length,
          offlineIncidents: s[KEYS.offlineIncidents] || 0,
          extensionVersion: chrome.runtime.getManifest().version,
        });
      })();
      return true;

    case "SET_API_BASE":
      set({ [KEYS.apiBase]: (msg.apiBase || DEFAULT_API_BASE).replace(/\/+$/, "") })
        .then(() => sendResponse({ ok: true }));
      return true;

    default:
      return false;
  }
});
