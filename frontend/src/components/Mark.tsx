/**
 * SecureDesk mark — a boundary with a monitored crossing.
 * Data (the dash, entering from the left) meets the threshold (the vertical
 * rule) and stops. Deliberately not a shield: every security company uses one.
 */
export default function Mark({
  size = 24,
  className = "",
  tone = "currentColor",
}: {
  size?: number;
  className?: string;
  tone?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* frame */}
      <rect
        x="2.25" y="2.25" width="19.5" height="19.5" rx="3"
        stroke={tone} strokeWidth="1.5" opacity="0.42"
      />
      {/* the threshold */}
      <path d="M14.25 5.5V18.5" stroke={tone} strokeWidth="1.9" strokeLinecap="round" />
      {/* data arriving, halted at the line */}
      <path d="M6 12H11.4" stroke={tone} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

/** Wordmark lockup used in nav bars and the console rail. */
export function Wordmark({
  size = 22,
  className = "",
  sub,
}: {
  size?: number;
  className?: string;
  sub?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Mark size={size} />
      <div className="leading-none">
        <span
          className="font-semibold tracking-[-0.02em]"
          style={{ fontSize: size * 0.78 }}
        >
          SecureDesk
        </span>
        {sub && (
          <div className="eyebrow mt-1" style={{ fontSize: "0.5625rem" }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
