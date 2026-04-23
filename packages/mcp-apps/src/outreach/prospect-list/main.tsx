import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { ProspectList } from "./ProspectList";

createRoot(document.getElementById("root")!).render(<ProspectList />);
