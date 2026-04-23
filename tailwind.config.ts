import type { Config } from "tailwindcss";
import { heroui } from "@heroui/theme";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
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
        serif: [
          '"Instrument Serif"',
          '"Cormorant Garamond"',
          "Georgia",
          "serif",
        ],
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
        mono: [
          '"JetBrains Mono"',
          '"IBM Plex Mono"',
          "ui-monospace",
          "monospace",
        ],
        hand: ['"Caveat"', '"Kalam"', "cursive"],
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
};

export default config;
