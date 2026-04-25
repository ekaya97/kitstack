import { defineView } from "../../sdk";
import { loader } from "./loader";
import { ExpenseTableView } from "./View";

export default defineView({
  slug: "expense-table",
  name: "Expense Table",
  description: "after adding or listing expenses, to review all entries",
  loader,
  component: ExpenseTableView,
  height: 500,
});
