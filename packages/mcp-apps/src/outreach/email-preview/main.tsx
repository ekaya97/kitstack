import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { EmailPreview } from "./EmailPreview";

createRoot(document.getElementById("root")!).render(<EmailPreview />);
