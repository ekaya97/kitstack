import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        "crm/pipeline": resolve(__dirname, "src/crm/pipeline/index.html"),
        "crm/contacts": resolve(__dirname, "src/crm/contacts/index.html"),
        "crm/contact-detail": resolve(__dirname, "src/crm/contact-detail/index.html"),
        "crm/dashboard": resolve(__dirname, "src/crm/dashboard/index.html"),
        "crm/proposal": resolve(__dirname, "src/crm/proposal/index.html"),
      },
    },
  },
});
