import { defineKit } from "@kitstackco/sdk";
import { resolve } from "node:path";
import * as schema from "./src/schema";
import { instructions } from "./src/instructions";

// Views
import dashboardView from "./src/views/dashboard";
import categoriesView from "./src/views/categories";
import vatReportView from "./src/views/vat-report";

// Tools
import { addExpense } from "./src/tools/add-expense";
import { addIncome } from "./src/tools/add-income";
import { listExpenses } from "./src/tools/list-expenses";
import { listIncome } from "./src/tools/list-income";
import { summary } from "./src/tools/summary";
import { byCategory } from "./src/tools/by-category";
import { vatReport } from "./src/tools/vat-report";
import { updateExpense } from "./src/tools/update-expense";
import { archive } from "./src/tools/archive";
import { setPreference } from "./src/tools/set-preference";
import { addCategory } from "./src/tools/add-category";
import { profitLoss } from "./src/tools/profit-loss";

export default defineKit({
  id: "expenses",
  version: "1.0.0",
  name: "Expenses",
  description: "Personal expense tracker for freelancers with German tax categories (SKR03), VAT handling, and Kleinunternehmer support",
  schema,
  migrationsDir: resolve(import.meta.dirname, "migrations"),
  instructions,
  triggers: [
    "expense", "income", "vat", "tax", "receipt",
    "budget", "steuerberater", "bookkeeping", "invoice", "skr03",
  ],
  views: [dashboardView, categoriesView, vatReportView],
  tools: [
    addExpense,
    addIncome,
    listExpenses,
    listIncome,
    summary,
    byCategory,
    vatReport,
    updateExpense,
    archive,
    setPreference,
    addCategory,
    profitLoss,
  ],
});
