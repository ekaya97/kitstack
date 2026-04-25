import { useKit, useTool } from "../../sdk-view";
import type { LoaderData } from "../../sdk";
import type contactDetailView from "./index";

type Data = LoaderData<typeof contactDetailView>;

const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞",
  email: "✉️",
  meeting: "🤝",
  note: "📝",
  task: "☑️",
};

export function ContactDetailView() {
  const { data, reload } = useKit<Data>();

  if (!data) {
    return <div className="p-4 text-ks-muted">Contact not found.</div>;
  }

  const { contact, deals, recentActivities } = data;

  return (
    <div className="p-4">
      <h1 className="font-serif text-xl mb-4">{contact.name}</h1>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-6">
        {contact.company && (
          <>
            <span className="text-ks-muted">Company</span>
            <span>{contact.company}</span>
          </>
        )}
        {contact.email && (
          <>
            <span className="text-ks-muted">Email</span>
            <span>{contact.email}</span>
          </>
        )}
        {contact.phone && (
          <>
            <span className="text-ks-muted">Phone</span>
            <span>{contact.phone}</span>
          </>
        )}
        {contact.source && (
          <>
            <span className="text-ks-muted">Source</span>
            <span>{contact.source}</span>
          </>
        )}
        {contact.lastContactedAt && (
          <>
            <span className="text-ks-muted">Last Contacted</span>
            <span>{contact.lastContactedAt}</span>
          </>
        )}
      </div>

      {contact.notes && (
        <div className="text-sm mb-6">
          <span className="text-ks-muted">Notes:</span> {contact.notes}
        </div>
      )}

      {deals.length > 0 && (
        <div className="mb-6">
          <h2 className="font-serif text-lg mb-2">Deals ({deals.length})</h2>
          <div className="space-y-2">
            {deals.map((d) => (
              <div key={d.id} className="border border-ks-hair rounded p-3 flex justify-between items-center">
                <div>
                  <span className="font-medium">{d.name}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-ks-paper-deep text-ks-ink">
                    {d.stage}
                  </span>
                </div>
                <span className="font-mono text-sm">
                  {d.value ? `€${d.value.toLocaleString()}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentActivities.length > 0 && (
        <div>
          <h2 className="font-serif text-lg mb-2">Recent Activity</h2>
          <div className="space-y-1 text-sm">
            {recentActivities.map((a) => (
              <div key={a.id} className="flex gap-2">
                <span>{ACTIVITY_ICONS[a.type] ?? "·"}</span>
                <span className="text-ks-muted">[{a.type}]</span>
                <span>{a.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
