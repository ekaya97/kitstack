import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { ContactsTable } from "./ContactsTable";

// Export mount function for dynamic loading from shell
export function mount(container: HTMLElement) {
  createRoot(container).render(<ContactsTable />);
}

// Register globally for shell dynamic loading
((window as any).__KITSTACK_VIEWS__ ??= {})["crm/contacts"] = { mount };

// Self-mount when loaded as standalone HTML (backward compat)
const root = document.getElementById("root");
if (root) mount(root);
