import type { Config } from "tailwindcss";

export default {
  content: ["./src/views/**/*.tsx"],
  presets: [require("@kitstackco/sdk/tailwind-preset")],
} satisfies Config;
