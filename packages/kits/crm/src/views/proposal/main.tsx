import { createRoot } from "react-dom/client";
import { ProposalView } from "./View";

export function mount(container: HTMLElement) {
  createRoot(container).render(<ProposalView />);
}

((window as any).__KITSTACK_VIEWS__ ??= {})["crm/proposal"] = { mount };
