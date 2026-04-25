import { defineKit } from "./src/sdk";
import * as schema from "./src/schema";
import { migrationSql } from "./src/migrations";
import { expenseInstructions } from "./src/instructions";

// Tools
import { addExpense } from "./src/tools/add-expense";
import { importCsv } from "./src/tools/import-csv";
import { listExpenses } from "./src/tools/list-expenses";
import { categorize } from "./src/tools/categorize";
import { quarterlySummary } from "./src/tools/quarterly-summary";
import { exportSteuerberater } from "./src/tools/export-steuerberater";
import { updateExpense } from "./src/tools/update-expense";

// Views
import expenseTableView from "./src/views/expense-table";
import categoryDashboardView from "./src/views/category-dashboard";
import importReviewView from "./src/views/import-review";
import steuerberaterExportView from "./src/views/steuerberater-export";

export default defineKit({
  id: "expense-tax-prep",
  version: "1.0.0",
  name: "Expense & Tax Prep Kit",
  description: "Expense tracking and tax preparation for the German market with SKR03/SKR04, VAT handling, and Steuerberater export",
  schema,
  migrationSql,
  instructions: expenseInstructions,
  tools: [
    addExpense,
    importCsv,
    listExpenses,
    categorize,
    quarterlySummary,
    exportSteuerberater,
    updateExpense,
  ],
  views: [
    expenseTableView,
    categoryDashboardView,
    importReviewView,
    steuerberaterExportView,
  ],
});
