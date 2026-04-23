import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { CategoryDashboard } from "./CategoryDashboard";

createRoot(document.getElementById("root")!).render(<CategoryDashboard />);
