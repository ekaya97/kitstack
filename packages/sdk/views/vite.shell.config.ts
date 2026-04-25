import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

export default defineConfig({
  plugins: [viteSingleFile()],
  define: {
    "import.meta.env.VITE_CDN_URL": JSON.stringify(process.env.VITE_CDN_URL || ""),
  },
  build: {
    rollupOptions: {
      input: resolve(__dirname, "src/app-shell.html"),
    },
  },
});
