import { createRoot } from "react-dom/client";
import { useState } from "react";
import "./shared/styles.css";

import { PipelineKanban } from "./crm/pipeline/PipelineKanban";
import { ContactsTable } from "./crm/contacts/ContactsTable";
import { Dashboard } from "./crm/dashboard/Dashboard";
import { ContactDetail } from "./crm/contact-detail/ContactDetail";

const VIEWS = [
  { key: "pipeline", label: "Pipeline", component: PipelineKanban },
  { key: "contacts", label: "Contacts", component: ContactsTable },
  { key: "dashboard", label: "Dashboard", component: Dashboard },
  { key: "contact-detail", label: "Contact Detail", component: ContactDetail },
];

function App() {
  const [active, setActive] = useState("pipeline");
  const View = VIEWS.find((v) => v.key === active)!.component;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#faf7f1" }}>
      <nav style={{ width: 180, padding: 16, borderRight: "1px solid #d9ceb8", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 18, marginBottom: 16 }}>CRM Views</div>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setActive(v.key)}
            style={{
              textAlign: "left", padding: "6px 10px", borderRadius: 6, border: "none",
              background: active === v.key ? "#f4ede0" : "transparent",
              fontWeight: active === v.key ? 600 : 400,
              fontSize: 13, cursor: "pointer", fontFamily: "Inter, sans-serif",
            }}
          >
            {v.label}
          </button>
        ))}
      </nav>
      <main style={{ flex: 1, overflow: "auto" }}>
        <View />
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
