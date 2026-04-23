import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { ContactDetail } from "./ContactDetail";

createRoot(document.getElementById("root")!).render(<ContactDetail />);
