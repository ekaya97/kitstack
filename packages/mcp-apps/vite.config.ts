import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

const entry = process.env.APP_ENTRY;

export default defineConfig({
  plugins: [react(), ...(entry ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  build: {
    rollupOptions: {
      input: entry
        ? { [entry]: resolve(__dirname, `src/${entry}/index.html`) }
        : {
            // Multi-entry fallback (for website previews, no inlining)
            "crm/pipeline": resolve(__dirname, "src/crm/pipeline/index.html"),
            "crm/contacts": resolve(__dirname, "src/crm/contacts/index.html"),
            "crm/contact-detail": resolve(__dirname, "src/crm/contact-detail/index.html"),
            "crm/dashboard": resolve(__dirname, "src/crm/dashboard/index.html"),
            "crm/proposal": resolve(__dirname, "src/crm/proposal/index.html"),
            "expense/expense-table": resolve(__dirname, "src/expense/expense-table/index.html"),
            "expense/category-dashboard": resolve(__dirname, "src/expense/category-dashboard/index.html"),
            "expense/import-review": resolve(__dirname, "src/expense/import-review/index.html"),
            "expense/steuerberater-export": resolve(__dirname, "src/expense/steuerberater-export/index.html"),
            "outreach/sequence-builder": resolve(__dirname, "src/outreach/sequence-builder/index.html"),
            "outreach/prospect-list": resolve(__dirname, "src/outreach/prospect-list/index.html"),
            "outreach/email-preview": resolve(__dirname, "src/outreach/email-preview/index.html"),
            "meeting/meeting-summary": resolve(__dirname, "src/meeting/meeting-summary/index.html"),
            "meeting/action-tracker": resolve(__dirname, "src/meeting/action-tracker/index.html"),
            "meeting/meeting-history": resolve(__dirname, "src/meeting/meeting-history/index.html"),
          },
    },
  },
});
