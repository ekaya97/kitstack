import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { ContactsTable } from "./ContactsTable";

createRoot(document.getElementById("root")!).render(<ContactsTable />);
