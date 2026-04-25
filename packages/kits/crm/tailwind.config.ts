import type { Config } from "tailwindcss";
import kitStackPreset from "../../sdk-stub/src/tailwind-preset";

export default {
  presets: [kitStackPreset],
  content: ["./src/views/**/*.tsx"],
} satisfies Config;
