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

/* ── Multi-line trend, with a toggleable legend ──────────────────────
   Same axis/gridline/tooltip mechanics as EventVolume, but lines rather
   than stacked bars — for comparing several time series (not parts of one
   whole) over the same window. Clicking a legend item hides that series,
   for isolating a single signal.                                      */
export function MultiLine({
  data,
  series,
  height = 168,
}: {
  data: Array<{ label: string; full: string } & Record<string, number | string>>;
  series: { key: string; label: string; token: string }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = series.filter((s) => !hidden.has(s.key));

  const max = Math.max(1, ...data.flatMap((d) => visible.map((s) => Number(d[s.key]) || 0)));
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 40 ? 10 : Math.ceil(max / 4 / 10) * 10;
  const top = Math.ceil(max / step) * step || 1;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  const AXIS_W = 30;
  const W = 100;
  const plotH = height;
  const slot = W / Math.max(data.length - 1, 1);
  const y = (v: number) => plotH - (v / top) * (plotH - 6);

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        {series.map((s) => {
          const off = hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className="flex items-center gap-1.5 transition-opacity"
              style={{ opacity: off ? 0.4 : 1, background: "none", border: "none", cursor: "pointer", padding: 0 }}
              aria-pressed={!off}
            >
              <span className="w-2 h-2 rounded-xs flex-none" style={{ background: s.token }} />
              <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative flex" style={{ gap: 8 }}>
        <div className="relative flex-none" style={{ width: AXIS_W, height: plotH }} aria-hidden="true">
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
            viewBox={`0 0 ${W} ${plotH}`}
            width="100%"
            height={plotH}
            preserveAspectRatio="none"
            role="img"
            aria-label="Threat activity trend over the last 14 days"
            style={{ display: "block", overflow: "visible" }}
          >
            {ticks.map((t) => (
              <line
                key={t}
                x1={0} x2={W} y1={y(t)} y2={y(t)}
                stroke="var(--line-1)" strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {visible.map((s) => {
              const pts = data.map((d, i) => [i * slot, y(Number(d[s.key]) || 0)]);
              const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
              return (
                <path
                  key={s.key}
                  d={path}
                  fill="none"
                  stroke={s.token}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {hover !== null && (
              <line
                x1={hover * slot} x2={hover * slot} y1={0} y2={plotH}
                stroke="var(--line-2)" strokeWidth="0.5" vectorEffect="non-scaling-stroke"
              />
            )}

            {data.map((_, i) => (
              <rect
                key={i}
                x={Math.max(0, i * slot - slot / 2)} y={0} width={slot} height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}

            {hover !== null &&
              visible.map((s) => (
                <circle key={s.key} cx={hover * slot} cy={y(Number(data[hover][s.key]) || 0)} r="2" fill={s.token} />
              ))}

            <line x1={0} x2={W} y1={plotH} y2={plotH} stroke="var(--line-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>

          <div className="flex mt-1.5">
            {data.map((d, i) => {
              const every = data.length > 10 ? Math.ceil(data.length / 6) : 1;
              return (
                <span
                  key={d.full}
                  className="mono text-[9.5px] text-center"
                  style={{ flex: 1, color: "var(--text-4)" }}
                >
                  {i % every === 0 ? d.label : " "}
                </span>
              );
            })}
          </div>

          {hover !== null && (
            <div
              className="absolute pointer-events-none rounded-md px-3 py-2 z-20"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--line-2)",
                boxShadow: "var(--shadow-panel)",
                top: 4,
                left: `${Math.min(Math.max((hover * slot / W) * 100, 6), 74)}%`,
              }}
              role="status"
            >
              <p className="mono text-[10px] tracking-[0.08em] uppercase mb-1.5" style={{ color: "var(--text-4)" }}>
                {data[hover].full}
              </p>
              {series.map((s) => (
                <p
                  key={s.key}
                  className="flex items-center gap-2 text-[11.5px]"
                  style={{ color: hidden.has(s.key) ? "var(--text-4)" : "var(--text-2)" }}
                >
                  <span className="w-2 h-2 rounded-xs flex-none" style={{ background: s.token }} />
                  <span className="flex-1">{s.label}</span>
                  <span className="mono tabular-nums" style={{ color: "var(--text-1)" }}>
                    {data[hover][s.key]}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Risk ring — composite posture score ──────────────────────────── */
export function RiskRing({ score, size = 128, strokeWidth = 10 }: { score: number; size?: number; strokeWidth?: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (clamped / 100);
  const tone = clamped >= 76 ? "var(--sev-block)" : clamped >= 51 ? "var(--sev-warn)" : "var(--accent)";

  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      role="img" aria-label={`Security risk score: ${clamped} of 100`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-in)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={tone} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray .4s cubic-bezier(.2,.8,.2,1)" }}
      />
      <text
        x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
        style={{ fill: "var(--text-1)", fontSize: size * 0.26, fontWeight: 650, fontFamily: "inherit" }}
      >
        {clamped}
      </text>
      <text
        x="50%" y="66%" textAnchor="middle" dominantBaseline="middle"
        className="mono"
        style={{ fill: "var(--text-4)", fontSize: size * 0.09, letterSpacing: "0.08em" }}
      >
        / 100
      </text>
    </svg>
  );
}

/* ── Horizontal risk bars — department/entity risk, score + volume ─── */
export function RiskHBars({
  rows,
  emptyLabel = "No department activity yet.",
}: {
  rows: { label: string; score: number; events: number }[];
  emptyLabel?: string;
}) {
  if (!rows.length) {
    return (
      <p className="text-[12.5px]" style={{ color: "var(--text-4)" }}>
        {emptyLabel}
      </p>
    );
  }
  const toneOf = (s: number) =>
    s >= 70 ? "var(--sev-block)" : s >= 45 ? "var(--sev-warn)" : "color-mix(in srgb, var(--sev-allow) 58%, var(--surface-1))";

  return (
    <ol className="space-y-3">
      {rows.map((d) => (
        <li key={d.label}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
              {d.label}
            </span>
            <span className="flex items-baseline gap-2 flex-none">
              <span className="mono text-[13px] tabular-nums font-medium" style={{ color: "var(--text-1)" }}>
                {d.score}
              </span>
              <span className="mono text-[11px] tabular-nums" style={{ color: "var(--text-4)" }}>
                {d.events} events
              </span>
            </span>
          </div>
          <div className="h-2 rounded-sm" style={{ background: "var(--surface-in)" }}>
            <div
              className="h-full rounded-sm"
              style={{ width: `${d.score}%`, background: toneOf(d.score), transition: "width .3s" }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ── Donut — composition of a whole into a handful of named parts ────
   Reserved for genuine part-of-whole reads with few categories (here:
   exposure by data type). SeveritySplit stays a stacked bar; this is the
   one place a donut earns its keep over that, because the categories are
   an identity set (what kind), not an ordered escalation.              */
export function Donut({
  data,
  size = 128,
}: {
  data: { label: string; value: number; token: string }[];
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 13;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;

  if (!total) {
    return (
      <p className="text-[12.5px]" style={{ color: "var(--text-4)" }}>
        No exposure data yet.
      </p>
    );
  }

  let offset = 0;

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Sensitive data exposure: ${data.map((d) => `${d.label} ${Math.round((d.value / total) * 100)}%`).join(", ")}`}
      >
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-in)" strokeWidth={13} />
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = c * frac;
            const seg = (
              <circle
                key={d.label}
                cx={cx} cy={cy} r={r} fill="none"
                stroke={d.token}
                strokeWidth={hover === i ? 15 : 13}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                opacity={hover === null || hover === i ? 1 : 0.42}
                style={{ transition: "opacity .12s, stroke-width .12s", cursor: "default" }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
            offset += dash;
            return seg;
          })}
        </g>
        <text
          x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="mono"
          style={{ fill: "var(--text-1)", fontSize: size * 0.15, fontWeight: 650 }}
        >
          {hover !== null ? `${Math.round((data[hover].value / total) * 100)}%` : total}
        </text>
      </svg>

      <ul className="space-y-1.5 min-w-0 flex-1">
        {data.map((d, i) => (
          <li
            key={d.label}
            className="flex items-center gap-2 text-[12.5px] transition-colors"
            style={{ color: hover === i ? "var(--text-1)" : "var(--text-3)" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="w-2 h-2 rounded-xs flex-none" style={{ background: d.token }} />
            <span className="flex-1 truncate">{d.label}</span>
            <span className="mono tabular-nums" style={{ color: "var(--text-1)" }}>
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
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
