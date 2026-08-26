/**
 * A static recreation of the Chrome extension's real BLOCK card
 * (extension/content.js's buildBlockCard) — not a captured screenshot
 * (nothing in this repo can drive a real browser to take one), so this is
 * built from the same markup/colors as the actual card rather than
 * approximated. Deliberately uses the EXTENSION's own dark theme
 * (#0A0A0C / #141418 / #DC143C) rather than the web app's blue accent —
 * this is depicting the extension's UI, not SecureDesk-the-web-app's
 * brand, so borrowing its real palette here is correct, not a mismatch.
 */
export default function BlockModalPreview() {
  const T = {
    bg: "#0A0A0C",
    surface: "#141418",
    border: "#26262C",
    text: "#F5F5F7",
    textMuted: "#8A8A94",
    error: "#DC143C",
  };

  return (
    <div
      className="rounded-xl overflow-hidden mx-auto"
      style={{
        width: 380,
        maxWidth: "100%",
        background: T.surface,
        border: `1px solid ${T.border}`,
        boxShadow: "0 32px 80px -28px rgba(5,7,10,.55)",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      }}
    >
      <div className="p-5" style={{ color: T.text }}>
        <div className="flex items-center gap-2.5 mb-3.5">
          <div
            className="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-none text-[15px]"
            style={{ background: T.error }}
          >
            🛡️
          </div>
          <div>
            <div className="font-bold text-[14px]">SecureDesk</div>
            <div className="text-[11px] truncate" style={{ color: T.textMuted }}>
              aadhaar_photo.jpg
            </div>
          </div>
        </div>

        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold mb-3"
          style={{ background: "rgba(220,20,60,.15)", color: "#ff8fa3", border: `1px solid ${T.error}` }}
        >
          🚫 File Blocked
        </div>

        <ul className="mb-3.5 space-y-0">
          {[
            "Image identified as an Aadhaar card (high confidence)",
            "Government-issued ID — DPDP-regulated personal data",
          ].map((r, i, arr) => (
            <li
              key={r}
              className="text-[12.5px] py-1.5 leading-snug"
              style={{ borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}
            >
              {r}
            </li>
          ))}
        </ul>

        <p className="text-[11.5px] leading-relaxed mb-4" style={{ color: T.textMuted }}>
          This decision has been logged to your organisation's compliance record.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            tabIndex={-1}
            className="flex-1 py-2.5 rounded-md text-[13px] font-semibold"
            style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.textMuted }}
          >
            Request Override
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="flex-1 py-2.5 rounded-md text-[13px] font-semibold"
            style={{ background: T.error, color: "#fff" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
