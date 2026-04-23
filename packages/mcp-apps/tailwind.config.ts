import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,html}"],
  plugins: [typography],
  theme: {
    extend: {
      colors: {
        ks: {
          paper: "#faf7f1",
          "paper-warm": "#f4ede0",
          "paper-deep": "#ece3d1",
          ink: "#171512",
          ink2: "#2a251f",
          muted: "#6b6357",
          faint: "#b8ae9b",
          line: "#1a1814",
          hair: "#d9ceb8",
          accent: "#d65a2f",
          "accent-deep": "#a8411e",
          "accent-soft": "#f7d9c8",
          hi: "#ffe45c",
        },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
};

export default config;
