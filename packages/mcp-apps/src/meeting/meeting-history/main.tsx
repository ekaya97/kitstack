import { createRoot } from "react-dom/client";
import "@shared/styles.css";
import { MeetingHistory } from "./MeetingHistory";

createRoot(document.getElementById("root")!).render(<MeetingHistory />);
