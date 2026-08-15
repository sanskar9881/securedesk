import { useState, useId } from "react";

/* ═══════════════════════════════════════════════════════════════════
   Chart primitives, hand-rolled in SVG.

   Severity is encoded as an escalation scale, never a traffic light:
     allow  → neutral   (baseline noise, must not draw the eye)
     warn   → amber
     block  → crimson   (crimson, not red: beside amber it holds ΔE 15.5
                         under deuteranopia where red/amber collapses to 7.6)

   Colour never carries identity alone — every series is named in the
   legend and repeated in the tooltip.
   ═══════════════════════════════════════════════════════════════════ */

export type Bucket = { label: string; full: string; allow: number; warn: number; block: number };

const SERIES = [
  { key: "block" as const, label: "High", token: "var(--sev-block)" },
  { key: "warn" as const, label: "Medium", token: "var(--sev-warn)" },
  { key: "allow" as const, label: "Low", token: "color-mix(in srgb, var(--sev-allow) 58%, var(--surface-1))" },
];

/* ── Stacked volume over time ──────────────────────────────────── */
export function EventVolume({ data, height = 168 }: { data: Bucket[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId();

  const max = Math.max(1, ...data.map((d) => d.allow + d.warn + d.block));
  // A tidy axis top, so gridlines land on round numbers.
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 40 ? 10 : Math.ceil(max / 4 / 10) * 10;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  // The SVG is stretched to fill its container (preserveAspectRatio="none"),
  // which would distort any text inside it — so axis labels live in HTML
  // alongside the plot, and the SVG carries marks only.
  const AXIS_W = 30; // px reserved for the y-axis label column
  const PAD_L = 0;
  const PAD_B = 0;
  const W = 100; // viewBox units, scaled by CSS
  const plotH = height - PAD_B;
  const slot = (W - PAD_L) / Math.max(data.length, 1);
  const barW = Math.min(slot * 0.62, 9);

  const y = (v: number) => plotH - (v / top) * (plotH - 6);

  return (
    <div className="relative flex" style={{ gap: 8 }}>
      {/* y axis, in HTML so the glyphs never distort */}
      <div className="relative flex-none" style={{ width: AXIS_W, height }} aria-hidden="true">
        {ticks.map((t) => (
          <span
            key={t}
            className="mono text-[9.5px] absolute right-0 tabular-nums"
            style={{ top: y(t) - 6, color: "var(--text-4)" }}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="flex-1 min-w-0">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Events per day by severity over the last ${data.length} days. Peak ${max} in a day.`}
        style={{ display: "block", overflow: "visible" }}
      >
        {/* recessive gridlines */}
        {ticks.map((t) => (
          <line
            key={t}
            x1={PAD_L} x2={W} y1={y(t)} y2={y(t)}
            stroke="var(--line-1)" strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {data.map((d, i) => {
          const cx = PAD_L + slot * i + slot / 2;
          const total = d.allow + d.warn + d.block;
          let cursor = 0;
          const active = hover === i;

          return (
            <g key={d.full}>
              {/* generous hit target, independent of the mark */}
              <rect
                x={PAD_L + slot * i} y={0} width={slot} height={plotH}
                fill={active ? "var(--surface-2)" : "transparent"}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "default" }}
              />
              {total === 0 ? (
                /* an explicit zero mark reads better than a gap */
                <line
                  x1={cx - barW / 2} x2={cx + barW / 2} y1={plotH} y2={plotH}
                  stroke="var(--line-2)" strokeWidth="1" vectorEffect="non-scaling-stroke"
                />
              ) : (
                SERIES.map(({ key, token }) => {
                  const v = d[key];
                  if (!v) return null;
                  const h = (v / top) * (plotH - 6);
                  const yTop = plotH - cursor - h;
                  cursor += h;
                  return (
                    <rect
                      key={key}
                      x={cx - barW / 2}
                      y={yTop}
                      width={barW}
                      height={Math.max(h - 0.8, 0.6)}   /* 2px surface gap between segments */
                      rx="1.2"
                      fill={token}
                      opacity={hover === null || active ? 1 : 0.45}
                      style={{ transition: "opacity .12s" }}
                    />
                  );
                })
              )}
            </g>
          );
        })}

        {/* baseline */}
        <line
          x1={PAD_L} x2={W} y1={plotH} y2={plotH}
          stroke="var(--line-2)" strokeWidth="1" vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* x labels — thinned so they never collide */}
      <div className="flex mt-1.5">
        {data.map((d, i) => {
          const every = data.length > 10 ? Math.ceil(data.length / 6) : 1;
          return (
            <span
              key={d.full}
              className="mono text-[9.5px] text-center"
              style={{ flex: 1, color: "var(--text-4)" }}
            >
              {i % every === 0 ? d.label : " "}
            </span>
          );
        })}
      </div>

      {/* tooltip */}
      {hover !== null && (
        <div
          className="absolute pointer-events-none rounded-md px-3 py-2 z-20"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--line-2)",
            boxShadow: "var(--shadow-panel)",
            top: 4,
            left: `${Math.min(Math.max(((slot * hover + slot / 2) / W) * 100, 6), 74)}%`,
          }}
          role="status"
        >
          <p className="mono text-[10px] tracking-[0.08em] uppercase mb-1.5" style={{ color: "var(--text-4)" }}>
            {data[hover].full}
          </p>
          {SERIES.map(({ key, label, token }) => (
            <p key={key} className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--text-2)" }}>
              <span className="w-2 h-2 rounded-xs flex-none" style={{ background: token }} />
              <span className="flex-1">{label}</span>
              <span className="mono tabular-nums" style={{ color: "var(--text-1)" }}>
                {data[hover][key]}
              </span>
            </p>
          ))}
        </div>
      )}
      </div>
      <span id={gid} className="sr-only" />
    </div>
  );
}

/** Legend — always present, so identity is never colour alone. */
export function SeverityLegend() {
  return (
    <div className="flex items-center gap-4">
      {SERIES.map(({ key, label, token }) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-xs flex-none" style={{ background: token }} />
          <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ── Sparkline for metric tiles ────────────────────────────────── */
export function Sparkline({
  values,
  tone = "var(--accent)",
  width = 64,
  height = 18,
}: {
  values: number[];
  tone?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const dx = width / (values.length - 1);
  const pts = values.map((v, i) => [i * dx, height - (v / max) * (height - 2) - 1]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <path d={area} fill={tone} opacity="0.12" />
      <path d={d} fill="none" stroke={tone} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* emphasised endpoint */}
      <circle cx={last[0]} cy={last[1]} r="2" fill={tone} />
    </svg>
  );
}

/* ── Severity split ────────────────────────────────────────────────
   A single stacked bar rather than a donut: comparing three parts of one
   whole is a length judgement, which people read far more accurately than
   the angle judgement a pie/donut demands. Each segment is labelled, so
   identity never rests on colour.                                    */
export function SeveritySplit({
  block,
  warn,
  allow,
}: {
  block: number;
  warn: number;
  allow: number;
}) {
  const total = block + warn + allow;
  const rows = [
    { key: "block", label: "High", value: block, token: "var(--sev-block)" },
    { key: "warn", label: "Medium", value: warn, token: "var(--sev-warn)" },
    {
      key: "allow",
      label: "Low",
      value: allow,
      token: "color-mix(in srgb, var(--sev-allow) 58%, var(--surface-1))",
    },
  ];

  if (!total) {
    return (
      <p className="text-[12.5px]" style={{ color: "var(--text-4)" }}>
        Nothing recorded yet.
      </p>
    );
  }

  return (
    <div>
      <div
        className="flex h-2.5 rounded-sm overflow-hidden"
        style={{ background: "var(--surface-in)", gap: "2px" }}
        role="img"
        aria-label={`Severity split: ${rows.map((r) => `${r.label} ${r.value}`).join(", ")}`}
      >
        {rows.map((r) =>
          r.value ? (
            <span
              key={r.key}
              style={{ background: r.token, width: `${(r.value / total) * 100}%` }}
            />
          ) : null
        )}
      </div>

      <dl className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-[12.5px]">
            <span
              className="w-2 h-2 rounded-[2px] flex-none"
              style={{ background: r.token }}
              aria-hidden="true"
            />
            <dt className="flex-1" style={{ color: "var(--text-3)" }}>
              {r.label}
            </dt>
            <dd className="tabular-nums font-medium" style={{ color: "var(--text-1)" }}>
              {r.value}
            </dd>
            <dd className="tabular-nums w-9 text-right" style={{ color: "var(--text-4)" }}>
              {Math.round((r.value / total) * 100)}%
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Ranked bars ───────────────────────────────────────────────────
   Who or what is driving the risk. Sorted descending and bar-encoded so
   the ranking reads before any number does.                          */
export function RankedBars({
  rows,
  emptyLabel = "Nothing to rank yet.",
}: {
  rows: { label: string; value: number; hint?: string }[];
  emptyLabel?: string;
}) {
  if (!rows.length) {
    return (
      <p className="text-[12.5px]" style={{ color: "var(--text-4)" }}>
        {emptyLabel}
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[12.5px] truncate" style={{ color: "var(--text-2)" }}>
              {r.label}
            </span>
            <span
              className="text-[12px] tabular-nums flex-none"
              style={{ color: "var(--text-3)" }}
            >
              {r.value}
              {r.hint && <span style={{ color: "var(--text-4)" }}> {r.hint}</span>}
            </span>
          </div>
          <div className="h-1.5 rounded-sm" style={{ background: "var(--surface-in)" }}>
            <div
              className="h-full rounded-sm"
              style={{
                width: `${(r.value / max) * 100}%`,
                background: "var(--accent)",
                opacity: 1 - i * 0.13,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
