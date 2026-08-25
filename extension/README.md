# SecureDesk Chrome Extension

DPDP-compliant DLP for WhatsApp Web. Intercepts file attachments, drag-drop,
and paste **before** WhatsApp receives them, scans via the SecureDesk
backend, and only releases the file on ALLOW (or an explicit "Send Anyway"
on WARN). See `content.js`'s module docstring for how the interception
itself works.

## Load unpacked (development)

1. `chrome://extensions` → enable **Developer mode** (top right).
2. **Load unpacked** → select this `extension/` folder.
3. Pin the SecureDesk icon to the toolbar.

## Point it at a local backend

Default API base is the production backend
(`https://securedesk-backend.onrender.com/api`), already covered by
`manifest.json`'s `host_permissions`. To test against `http://localhost:8000`
(also pre-declared in `host_permissions`), open the service worker console
(`chrome://extensions` → SecureDesk → "service worker" link) and run:

```js
chrome.runtime.sendMessage({ type: "SET_API_BASE", apiBase: "http://localhost:8000/api" })
```

## Enrol a device

1. In the web app, an authenticated user calls `POST /api/auth/devices`
   (there's no dedicated UI for this yet — see the note in the top-level
   report) and copies the returned `device_token` (`sdt_...`).
2. Open the SecureDesk popup → paste the token → **Enrol This Device**.
   The popup validates it with one small real scan call before storing it
   (there's no separate validation endpoint — see `background.js`).

## Manual verification checklist

- [ ] `chrome://extensions` shows no manifest/parse errors after loading unpacked.
- [ ] Popup shows the **not-enrolled** view with the token/label fields.
- [ ] Enrolling with a garbage string shows an inline error, doesn't crash.
- [ ] Enrolling with a real `sdt_...` token flips the popup to the dashboard view.
- [ ] On `web.whatsapp.com`, attaching a file shows the scanning overlay immediately —
      WhatsApp's own file preview must **not** appear until a verdict is reached.
- [ ] A file with an Aadhaar/PAN pattern (or an ID photo) shows the BLOCK modal;
      closing it must leave WhatsApp's composer empty (file never reached it).
- [ ] "Request Override" on a BLOCK records a request and does **not** send the file.
- [ ] A borderline file shows WARN; "Send Anyway" actually attaches it to the message;
      "Cancel" leaves the composer empty.
- [ ] A clean file is released silently with only a 2s toast.
- [ ] Turning off Wi-Fi and attaching a file shows WARN with an "unverified/offline"
      reason within ~20s, never a silent send and never a hard block.
- [ ] Toolbar badge: `?` before enrollment, clears when healthy, `!` if a self-test
      fails, red count once something is blocked today.
- [ ] Popup diagnostics panel opens and "Copy Diagnostics" doesn't throw.

## Known limitations (see the top-level report for full detail)

- Paste-interception re-dispatch is best-effort — synthetic
  `ClipboardEvent.clipboardData` is read-only in most engines, so releasing
  a *pasted* file back into WhatsApp may not always reproduce; the user is
  told to paste again in that case.
- No enrollment-key exchange flow exists server-side; the popup takes a
  device token directly (see `background.js`'s docstring).
- Heartbeat is local-only — there's no backend endpoint to receive it yet.
