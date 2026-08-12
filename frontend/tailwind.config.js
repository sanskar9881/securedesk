/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Grounds ──────────────────────────────────────────────
        ink: {
          DEFAULT: "#0A0E12",   // console ground — near-black, cold blue bias
          raised:  "#11161C",   // panels sitting on the ground
          inset:   "#080B0F",   // wells, inputs, code
          line:    "#1D242C",   // hairline dividers
          line2:   "#2A333D",   // emphasized dividers / borders
        },
        paper: {
          DEFAULT: "#FCFCFA",   // marketing ground — off-white, faintly warm
          raised:  "#FFFFFF",
          sunk:    "#F2F3F0",
          line:    "#E2E5E1",
          line2:   "#CDD2CD",
        },
        // ── Type ─────────────────────────────────────────────────
        slate: {
          950: "#0A0E12",
          900: "#131A21",
          800: "#1F2933",
          700: "#33414E",
          600: "#4C5C6B",
          500: "#6B7B8A",
          400: "#8D9BA8",
          300: "#B4BFC8",
          200: "#D3DAE0",
          100: "#E8ECEF",
          50:  "#F5F7F8",
        },
        // ── Brand signal — deep petrol teal ──────────────────────
        signal: {
          DEFAULT: "#0E7C6B",
          ink:     "#0A5A4E",   // on light grounds
          bright:  "#2FD4B8",   // on dark grounds
          dim:     "#1A9E88",
          wash:    "#E4F2EF",   // light tint
          shade:   "#0C1F1C",   // dark tint
        },
        // ── Semantic — enforcement outcomes, never the accent ────
        block: { DEFAULT: "#C0392F", bright: "#F27A6E", wash: "#FBE9E7", shade: "#241110" },
        warn:  { DEFAULT: "#B5761B", bright: "#E9A53F", wash: "#FBF1DF", shade: "#231A0C" },
        allow: { DEFAULT: "#2E7D52", bright: "#5FC98A", wash: "#E6F3EB", shade: "#0F1F16" },
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
