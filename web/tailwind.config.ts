import type { Config } from "tailwindcss";
import { heroui } from "@heroui/theme";
import { createPreset } from "fumadocs-ui/tailwind-plugin";

const config: Config = {
  presets: [createPreset()],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./content/**/*.mdx",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
    "./node_modules/fumadocs-ui/dist/**/*.js",
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
          "var(--font-serif)",
          '"Cormorant Garamond"',
          "Georgia",
          "serif",
        ],
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: [
          "var(--font-mono)",
          '"IBM Plex Mono"',
          "ui-monospace",
          "monospace",
        ],
        hand: ["var(--font-hand)", '"Kalam"', "cursive"],
      },
    },
  },
  darkMode: "class",
  plugins: [heroui()],
};

export default config;
