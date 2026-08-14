/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Grounds ──────────────────────────────────────────────
        // Mirrors the CSS custom properties in src/index.css. Both are
        // verified by `npm run check:contrast` — change them together.
        ink: {
          DEFAULT: "#0A0C12",   // console ground — blue-violet tinted, not neutral gray
          raised:  "#12151F",   // panels sitting on the ground
          high:    "#191D2A",   // raised panel
          inset:   "#05060A",   // wells, inputs, code
          line:    "#343B50",   // hairline dividers — visible, 1.76:1
          line2:   "#454D63",   // emphasized dividers
        },
        paper: {
          DEFAULT: "#FFFFFF",   // marketing ground — clean white
          raised:  "#F3F5F9",   // alternating band, faint cool tint
          sunk:    "#E7ECF2",
          line:    "#BBC5D3",
          line2:   "#A3AEBE",
        },
        // ── Neutral ramp ─────────────────────────────────────────
        // 500 and darker are safe on light grounds (>=4.5:1 on white).
        // 400 and lighter are for DARK grounds only.
        slate: {
          950: "#0A0C12",
          900: "#131A24",
          800: "#1C2530",
          700: "#2C3846",
          600: "#4A5768",   // 7.36:1 on white
          500: "#5C6979",   // 5.60:1 on white — lightest safe on paper
          400: "#8B96A3",   // 6.51:1 on ink  — lightest safe on dark
          300: "#B3BECD",
          200: "#D3DAE4",
          100: "#E8ECF2",
          50:  "#F4F6F9",
        },
        // ── Brand accent — electric blue ──────────────────────────
        signal: {
          DEFAULT: "#1657C4",
          ink:     "#0F469F",   // on light grounds
          bright:  "#4C8EFF",   // on dark grounds
          dim:     "#7FADFF",
          wash:    "#E8F0FC",
          shade:   "#0B1A2E",
        },
        // ── Semantic — enforcement outcomes, never the accent ────
        block: { DEFAULT: "#C0362B", bright: "#FF8078", wash: "#FBEAE8", shade: "#2A100E" },
        warn:  { DEFAULT: "#8A5A00", bright: "#E3B341", wash: "#F9F0DC", shade: "#241B08" },
        allow: { DEFAULT: "#177530", bright: "#56D364", wash: "#E6F2E9", shade: "#0C1F12" },
      },
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "Segoe UI Variable Display",
          "Segoe UI", "system-ui", "Helvetica Neue", "Arial", "sans-serif",
        ],
        mono: [
          "ui-monospace", "SF Mono", "SFMono-Regular", "JetBrains Mono",
          "Menlo", "Consolas", "Liberation Mono", "monospace",
        ],
      },
      fontSize: {
        // display scale — tight tracking baked in
        "display-xl": ["clamp(2.85rem, 6.2vw, 5rem)",   { lineHeight: "0.98", letterSpacing: "-0.038em", fontWeight: "680" }],
        "display-lg": ["clamp(2.2rem, 4.4vw, 3.4rem)",  { lineHeight: "1.04", letterSpacing: "-0.032em", fontWeight: "660" }],
        "display-md": ["clamp(1.65rem, 2.9vw, 2.35rem)",{ lineHeight: "1.12", letterSpacing: "-0.026em", fontWeight: "640" }],
        "display-sm": ["1.3rem",  { lineHeight: "1.24", letterSpacing: "-0.018em", fontWeight: "620" }],
        // the mono label system
        "label":    ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.13em" }],
        "label-sm": ["0.625rem",  { lineHeight: "1.3", letterSpacing: "0.15em" }],
        "data":     ["0.8125rem", { lineHeight: "1.45", letterSpacing: "-0.005em" }],
        "data-sm":  ["0.75rem",   { lineHeight: "1.4",  letterSpacing: "0" }],
      },
      borderRadius: {
        // deliberately tight — instrument, not pill
        none: "0", xs: "2px", sm: "3px", DEFAULT: "4px", md: "5px", lg: "6px", xl: "8px",
      },
      spacing: { 18: "4.5rem", 22: "5.5rem", 30: "7.5rem", 38: "9.5rem" },
      maxWidth: { measure: "68ch", shell: "1240px", narrow: "780px" },
      boxShadow: {
        panel:  "0 1px 2px rgba(10,14,18,.05), 0 12px 32px -16px rgba(10,14,18,.16)",
        lifted: "0 2px 4px rgba(10,14,18,.06), 0 24px 56px -24px rgba(10,14,18,.24)",
        console:"0 1px 0 rgba(255,255,255,.03) inset, 0 16px 40px -20px rgba(0,0,0,.8)",
      },
      transitionTimingFunction: { swift: "cubic-bezier(.2,.8,.2,1)" },
      keyframes: {
        "trace-in":   { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "sweep":      { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(320%)" } },
        "pulse-dot":  { "0%,100%": { opacity: "1" }, "50%": { opacity: ".25" } },
        "meter":      { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
      },
      animation: {
        "trace-in":  "trace-in .34s cubic-bezier(.2,.8,.2,1) both",
        "sweep":     "sweep 2.4s cubic-bezier(.4,0,.6,1) infinite",
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
        "meter":     "meter .7s cubic-bezier(.2,.8,.2,1) both",
      },
    },
  },
  plugins: [],
};
