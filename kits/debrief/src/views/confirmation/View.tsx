import { useEffect, useState } from "react";
import { useKit } from "@kitstackco/sdk/view";
import { CONFIRMATION_FIELDS, type ConfirmationField, type ConfirmationViewData } from "./loader";

const labels: Record<ConfirmationField, string> = {
  outcome: "Outcome",
  next_step: "Next step",
  customer_update: "Customer update",
  discovered_address: "Discovered address",
  follow_up_date: "Follow-up date",
};

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  padding: 16,
};

export function ConfirmationView() {
  const { data, callTool, reload, loading } = useKit<ConfirmationViewData>();
  const [fields, setFields] = useState<Record<ConfirmationField, string>>(() => emptyFields(data));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data) setFields(emptyFields(data));
  }, [data]);

  if (!data) return <div style={{ padding: 16, color: "#6b7280" }}>Confirmation unavailable.</div>;

  const update = async (field: ConfirmationField, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    try {
      await callTool("update_debrief_draft", { session_id: data.sessionId, [field]: value });
      await reload();
      setMessage("Draft saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const confirm = async () => {
    try {
      await callTool("confirm_debrief_draft", { session_id: data.sessionId });
      await reload();
      setMessage("Debrief confirmed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const confirmed = data.state === "confirmed" || Boolean(data.confirmedEventId);
  return (
    <div style={{ display: "grid", gap: 12, padding: 16, fontFamily: "system-ui, sans-serif", color: "#111827" }}>
      <div style={{ ...card, display: "grid", gap: 4 }}>
        <div style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1 }}>Debrief confirmation</div>
        <h1 style={{ margin: 0, fontSize: 22 }}>Review the call outcome</h1>
        <div style={{ color: "#4b5563", fontSize: 13 }}>Session {data.sessionId} · {data.state}</div>
      </div>

      <div style={{ ...card, display: "grid", gap: 12 }}>
        {CONFIRMATION_FIELDS.map((field) => (
          <label key={field} style={{ display: "grid", gap: 5, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{labels[field]}</span>
            <textarea
              value={fields[field]}
              disabled={confirmed || loading}
              onChange={(event) => setFields((current) => ({ ...current, [field]: event.target.value }))}
              onBlur={() => { if (!confirmed && fields[field].trim()) void update(field, fields[field]); }}
              rows={field === "outcome" || field === "next_step" ? 2 : 3}
              style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 8, font: "inherit", resize: "vertical" }}
            />
          </label>
        ))}
        <button type="button" disabled={confirmed || loading} onClick={() => void confirm()} style={{ padding: "10px 14px", border: 0, borderRadius: 8, background: confirmed ? "#9ca3af" : "#111827", color: "#fff", cursor: confirmed ? "default" : "pointer" }}>
          {confirmed ? "Confirmed" : "Confirm debrief"}
        </button>
        {message && <div role="status" style={{ fontSize: 13, color: "#4b5563" }}>{message}</div>}
        {data.confirmedEventId && <div style={{ fontSize: 12, color: "#166534" }}>Saved event: {data.confirmedEventId}</div>}
      </div>
    </div>
  );
}

function emptyFields(data: ConfirmationViewData | undefined): Record<ConfirmationField, string> {
  return Object.fromEntries(CONFIRMATION_FIELDS.map((field) => [field, String(data?.draft.fields[field] ?? "")])) as Record<ConfirmationField, string>;
}
