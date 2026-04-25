import { defineKit } from "../../framework";
import * as schema from "./schema";
import { migrationSql } from "./migrations";
import { expenseInstructions } from "./instructions";
import { addExpense } from "./tools/add-expense";
import { importCsv } from "./tools/import-csv";
import { listExpenses } from "./tools/list-expenses";
import { categorize } from "./tools/categorize";
import { quarterlySummary } from "./tools/quarterly-summary";
import { exportSteuerberater } from "./tools/export-steuerberater";
import { updateExpense } from "./tools/update-expense";

export default defineKit({
  id: "expense-tax-prep",
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
});
