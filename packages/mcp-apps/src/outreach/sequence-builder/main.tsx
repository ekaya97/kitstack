import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { SequenceBuilder } from "./SequenceBuilder";

createRoot(document.getElementById("root")!).render(<SequenceBuilder />);
