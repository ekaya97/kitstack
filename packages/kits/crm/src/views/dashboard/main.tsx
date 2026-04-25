import { createRoot } from "react-dom/client";
import { DashboardView } from "./View";

export function mount(container: HTMLElement) {
  createRoot(container).render(<DashboardView />);
}

((window as any).__KITSTACK_VIEWS__ ??= {})["crm/dashboard"] = { mount };
