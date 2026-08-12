#!/usr/bin/env node
/**
 * WCAG 2.1 contrast gate.
 *
 * Parses the design tokens straight out of src/index.css (so it can never drift
 * from what actually ships) and asserts that every text token clears 4.5:1
 * against every surface it can sit on, in every theme.
 *
 * Run: npm run check:contrast
 * Exits non-zero on any failure so CI can block the merge.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(resolve(here, "../src/index.css"), "utf8");

/* ── colour maths ──────────────────────────────────────────────── */
const toLin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function parseColor(v) {
  v = v.trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.every((n) => !Number.isNaN(n))) return [p[0], p[1], p[2]];
  }
  return null;
}

const lum = ([r, g, b]) => 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);

function ratio(fg, bg) {
  const a = lum(fg), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* ── extract token blocks from the stylesheet ──────────────────── */
function tokensIn(selectorPattern) {
  const re = new RegExp(`(${selectorPattern})\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "m");
  const block = re.exec(CSS);
  if (!block) return null;
  const out = {};
  for (const line of block[2].split("\n")) {
    const m = /--([\w-]+)\s*:\s*([^;]+);/.exec(line);
    if (!m) continue;
    const rgb = parseColor(m[2]);
    if (rgb) out[m[1]] = { hex: m[2].trim(), rgb };
  }
  return out;
}

const THEMES = [
  { name: "console dark", tokens: tokensIn(":root") },
  { name: "console light / marketing", tokens: tokensIn("\\.light-mode,\\s*\\n?\\s*\\.tokens-light") },
];

/* ── the contract ──────────────────────────────────────────────── */
const SURFACES = ["surface-0", "surface-1", "surface-2", "surface-in"];
// text-4 is used for eyebrow labels and table headers — small text, so it is
// held to the full 4.5:1 bar, not the large-text exemption.
const TEXT = ["text-1", "text-2", "text-3", "text-4", "accent", "sev-block", "sev-warn", "sev-allow"];
const BORDERS = ["line-1", "line-2"];

const MIN_TEXT = 4.5;
const MIN_BORDER = 1.5;

let failures = 0;
let checks = 0;

for (const { name, tokens } of THEMES) {
  if (!tokens) {
    console.error(`✗ could not parse token block for "${name}" — check src/index.css selectors`);
    failures++;
    continue;
  }
  console.log(`\n\x1b[1m${name}\x1b[0m`);

  for (const t of TEXT) {
    if (!tokens[t]) { console.log(`  · ${t}: not defined, skipped`); continue; }
    const row = [];
    for (const s of SURFACES) {
      if (!tokens[s]) continue;
      const r = ratio(tokens[t].rgb, tokens[s].rgb);
      checks++;
      const ok = r >= MIN_TEXT;
      if (!ok) failures++;
      row.push(`${s.padEnd(10)} ${r.toFixed(2).padStart(5)} ${ok ? "\x1b[32mok\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}`);
    }
    console.log(`  ${t.padEnd(10)} ${row.join("   ")}`);
  }

  for (const b of BORDERS) {
    if (!tokens[b]) continue;
    for (const s of ["surface-0", "surface-1"]) {
      if (!tokens[s]) continue;
      const r = ratio(tokens[b].rgb, tokens[s].rgb);
      checks++;
      const ok = r >= MIN_BORDER;
      if (!ok) failures++;
      console.log(`  ${b.padEnd(10)} vs ${s.padEnd(10)} ${r.toFixed(2).padStart(5)} ${ok ? "\x1b[32mok\x1b[0m" : "\x1b[31mFAIL (border invisible)\x1b[0m"}`);
    }
  }
}

/* ── Tailwind neutral ramp vs the two marketing grounds ─────────────
   The marketing/auth pages use literal `text-slate-N` utilities rather than
   the CSS tokens, so they are not covered above. This asserts the documented
   contract: 500-and-darker are safe on paper, 400-and-lighter safe on ink.
   It is what caught text-slate-400 sitting on white at 3.1:1.              */
const TW = readFileSync(resolve(here, "../tailwind.config.js"), "utf8");
function twBlock(name) {
  const re = new RegExp(`${name}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`, "m");
  const m = re.exec(TW);
  if (!m) return null;
  const out = {};
  for (const mm of m[1].matchAll(/(\w+)\s*:\s*"(#[0-9A-Fa-f]{6})"/g)) out[mm[1]] = parseColor(mm[2]);
  return out;
}
const slate = twBlock("slate");
const paperBlk = twBlock("paper");
const inkBlk = twBlock("paper") && twBlock("ink");

if (slate && paperBlk && inkBlk) {
  console.log(`\n\x1b[1mtailwind slate ramp — ground safety contract\x1b[0m`);
  const grounds = [
    { label: "paper (white)", rgb: paperBlk.DEFAULT, safe: ["500", "600", "700", "800", "900", "950"] },
    { label: "paper-raised", rgb: paperBlk.raised, safe: ["500", "600", "700", "800", "900", "950"] },
    { label: "ink (console)", rgb: inkBlk.DEFAULT, safe: ["50", "100", "200", "300", "400"] },
  ];
  for (const g of grounds) {
    if (!g.rgb) continue;
    const bad = [];
    for (const step of g.safe) {
      if (!slate[step]) continue;
      const r = ratio(slate[step], g.rgb);
      checks++;
      if (r < MIN_TEXT) { failures++; bad.push(`slate-${step} ${r.toFixed(2)}`); }
    }
    console.log(
      `  ${g.label.padEnd(16)} declared-safe steps: ${bad.length === 0
        ? "\x1b[32mall clear\x1b[0m"
        : `\x1b[31mFAIL — ${bad.join(", ")}\x1b[0m`}`
    );
  }
}

console.log(
  `\n${failures === 0 ? "\x1b[32m✓" : "\x1b[31m✗"} ${checks - failures}/${checks} checks passed\x1b[0m`
);
if (failures > 0) {
  console.error(
    `\n${failures} contrast failure(s). Text must reach ${MIN_TEXT}:1; borders ${MIN_BORDER}:1.`
  );
  process.exit(1);
}
