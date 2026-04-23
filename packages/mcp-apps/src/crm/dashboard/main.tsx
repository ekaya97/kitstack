import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { Dashboard } from "./Dashboard";

createRoot(document.getElementById("root")!).render(<Dashboard />);
