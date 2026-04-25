import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { ProspectList } from "./ProspectList";

// Export mount function for dynamic loading from shell
export function mount(container: HTMLElement) {
  createRoot(container).render(<ProspectList />);
}

// Register globally for shell dynamic loading
((window as any).__KITSTACK_VIEWS__ ??= {})["outreach/prospect-list"] = { mount };

// Self-mount when loaded as standalone HTML (backward compat)
const root = document.getElementById("root");
if (root) mount(root);
