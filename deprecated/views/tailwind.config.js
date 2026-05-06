/** @type {import('tailwindcss').Config} */
export default {
  content: ["./**/*.tsx"],
  theme: {
    extend: {
      colors: {
        "ks-paper": "#faf7f1",
        "ks-paper-warm": "#f4ede0",
        "ks-paper-deep": "#ece3d1",
        "ks-ink": "#171512",
        "ks-ink2": "#2a251f",
        "ks-muted": "#6b6357",
        "ks-faint": "#b8ae9b",
        "ks-line": "#1a1814",
        "ks-hair": "#d9ceb8",
        "ks-accent": "#d65a2f",
        "ks-accent-deep": "#a8411e",
        "ks-accent-soft": "#f7d9c8",
        "ks-hi": "#ffe45c",
      },
      fontFamily: {
        serif: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
};
