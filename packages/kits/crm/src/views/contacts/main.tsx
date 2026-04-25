import { createRoot } from "react-dom/client";
import { ContactsView } from "./View";

export function mount(container: HTMLElement) {
  createRoot(container).render(<ContactsView />);
}

((window as any).__KITSTACK_VIEWS__ ??= {})["crm/contacts"] = { mount };
