import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { ExpenseTable } from "./ExpenseTable";

createRoot(document.getElementById("root")!).render(<ExpenseTable />);
