import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ts: {
          bg: "#0A1020",
          surface: "#0F1A33",
          panel: "#111D38",
          elevated: "#162447",
          border: "#1E3054",
          cyan: "#22D3EE",
          blue: "#3B82F6",
        },
        severity: {
          low: "#22C55E",
          moderate: "#EAB308",
          high: "#F97316",
          severe: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
