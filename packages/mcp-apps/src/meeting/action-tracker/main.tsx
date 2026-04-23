import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { ActionTracker } from "./ActionTracker";

createRoot(document.getElementById("root")!).render(<ActionTracker />);
