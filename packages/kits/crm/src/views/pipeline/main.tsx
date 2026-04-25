import { createRoot } from "react-dom/client";
import { PipelineView } from "./View";

export function mount(container: HTMLElement) {
  createRoot(container).render(<PipelineView />);
}

((window as any).__KITSTACK_VIEWS__ ??= {})["crm/pipeline"] = { mount };
