import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { PipelineKanban } from "./PipelineKanban";

createRoot(document.getElementById("root")!).render(<PipelineKanban />);
