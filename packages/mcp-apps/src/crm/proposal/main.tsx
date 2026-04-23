import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { ProposalPreview } from "./ProposalPreview";

createRoot(document.getElementById("root")!).render(<ProposalPreview />);
