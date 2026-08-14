/**
 * SecureDesk mark — a shield with the S carried through as a channel, not a
 * cutout so much as a threshold data has to pass. The asset is a single
 * transparent PNG (public/brand/mark.png); it's applied as a CSS mask rather
 * than rendered directly, so `tone` recolors it the same way the previous
 * SVG mark did with `currentColor` — one file, any color, any surface.
 */
const MARK_URL = "/brand/mark.png";
const ASPECT = 336 / 407; // source asset's natural width:height

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
    <span
      role="img"
      aria-hidden="true"
      className={`inline-block flex-none ${className}`}
      style={{
        width: size * ASPECT,
        height: size,
        backgroundColor: tone,
        WebkitMaskImage: `url(${MARK_URL})`,
        maskImage: `url(${MARK_URL})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
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
