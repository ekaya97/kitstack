import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { Dashboard } from "./Dashboard";

// Export mount function for dynamic loading from shell
export function mount(container: HTMLElement) {
  createRoot(container).render(<Dashboard />);
}

// Register globally for shell dynamic loading
((window as any).__KITSTACK_VIEWS__ ??= {})["crm/dashboard"] = { mount };

// Self-mount when loaded as standalone HTML (backward compat)
const root = document.getElementById("root");
if (root) mount(root);
