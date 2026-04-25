import { createRoot } from "react-dom/client";
import { ContactDetailView } from "./View";

export function mount(container: HTMLElement) {
  createRoot(container).render(<ContactDetailView />);
}

((window as any).__KITSTACK_VIEWS__ ??= {})["crm/contact-detail"] = { mount };
