import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Build each kit view as a loadable JS module with shared vendor/shared chunks.
// Output: dist-views/vendor.js, dist-views/shared.js, dist-views/{kit}/{view}.js

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  build: {
    outDir: "dist-views",
    cssCodeSplit: false, // single shared.css (6.3KB gzip) — per-kit purging deferred to SDK
    rollupOptions: {
      input: {
        // CRM
        "crm/pipeline": resolve(__dirname, "src/crm/pipeline/main.tsx"),
        "crm/contacts": resolve(__dirname, "src/crm/contacts/main.tsx"),
        "crm/contact-detail": resolve(__dirname, "src/crm/contact-detail/main.tsx"),
        "crm/dashboard": resolve(__dirname, "src/crm/dashboard/main.tsx"),
        "crm/proposal": resolve(__dirname, "src/crm/proposal/main.tsx"),
        // Expense
        "expense/expense-table": resolve(__dirname, "src/expense/expense-table/main.tsx"),
        "expense/category-dashboard": resolve(__dirname, "src/expense/category-dashboard/main.tsx"),
        "expense/import-review": resolve(__dirname, "src/expense/import-review/main.tsx"),
        "expense/steuerberater-export": resolve(__dirname, "src/expense/steuerberater-export/main.tsx"),
        // Outreach
        "outreach/sequence-builder": resolve(__dirname, "src/outreach/sequence-builder/main.tsx"),
        "outreach/prospect-list": resolve(__dirname, "src/outreach/prospect-list/main.tsx"),
        "outreach/email-preview": resolve(__dirname, "src/outreach/email-preview/main.tsx"),
        // Meeting
        "meeting/meeting-summary": resolve(__dirname, "src/meeting/meeting-summary/main.tsx"),
        "meeting/action-tracker": resolve(__dirname, "src/meeting/action-tracker/main.tsx"),
        "meeting/meeting-history": resolve(__dirname, "src/meeting/meeting-history/main.tsx"),
      },
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
        manualChunks(id) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) {
            return "vendor";
          }
          if (id.includes("src/shared/")) {
            return "shared";
          }
        },
      },
    },
  },
});
