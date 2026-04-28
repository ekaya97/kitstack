import type { Config } from "tailwindcss";

export default {
  content: ["./src/views/**/*.tsx"],
  presets: [require("@kitstack/sdk/tailwind-preset")],
} satisfies Config;
