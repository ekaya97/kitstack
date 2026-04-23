import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { MeetingSummary } from "./MeetingSummary";

createRoot(document.getElementById("root")!).render(<MeetingSummary />);
