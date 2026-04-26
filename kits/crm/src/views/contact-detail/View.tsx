import type { Infer } from "../../sdk";
import type { loader } from "./loader";

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-ks-paper-deep text-ks-ink",
  proposal: "bg-blue-50 text-blue-800",
  negotiation: "bg-amber-50 text-amber-800",
  won: "bg-emerald-50 text-emerald-800",
  lost: "bg-red-50 text-red-800",
};

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const ACTIVITY_ICONS: Record<string, string> = {
  call: "\ud83d\udcde",
  email: "\u2709\ufe0f",
  meeting: "\ud83e\udd1d",
  note: "\ud83d\udcdd",
  task: "\u2611\ufe0f",
};

function formatCurrency(value: number | null, currency = "EUR"): string {
  if (value == null) return "\u2014";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(value);
}

export function ContactDetailView({ data }: { data: Infer<typeof loader> }) {

  if (!data) {
    return <div className="p-4 text-ks-muted">Contact not found.</div>;
  }

  const { contact, deals, recentActivities } = data;

  return (
    <div className="p-4">
      <h1 className="font-serif text-xl mb-4">{contact.name}</h1>

      {/* Header card */}
      <div className="bg-ks-paper-warm rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {contact.company && (
            <div>
              <span className="text-ks-faint text-[10px] uppercase tracking-wider">Company</span>
              <div className="font-medium">{contact.company}</div>
            </div>
          )}
          {contact.email && (
            <div>
              <span className="text-ks-faint text-[10px] uppercase tracking-wider">Email</span>
              <div className="font-mono text-xs">{contact.email}</div>
            </div>
          )}
          {contact.phone && (
            <div>
              <span className="text-ks-faint text-[10px] uppercase tracking-wider">Phone</span>
              <div className="font-mono text-xs">{contact.phone}</div>
            </div>
          )}
          {contact.source && (
            <div>
              <span className="text-ks-faint text-[10px] uppercase tracking-wider">Source</span>
              <div>{contact.source}</div>
            </div>
          )}
        </div>
        {contact.notes && (
          <div className="mt-3 pt-3 border-t border-ks-hair/50 text-sm text-ks-muted">
            {contact.notes}
          </div>
        )}
      </div>

      {/* Deals */}
      {deals.length > 0 && (
        <div className="mb-4">
          <h2 className="font-serif text-base mb-2">Deals ({deals.length})</h2>
          <div className="flex flex-col gap-2">
            {deals.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 border border-ks-hair rounded-lg">
                <div>
                  <div className="font-medium text-[13px]">{d.name}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${STAGE_COLORS[d.stage] ?? ""}`}>
                    {STAGE_LABELS[d.stage] ?? d.stage}
                  </span>
                </div>
                <span className="font-mono text-sm font-medium text-ks-accent">
                  {formatCurrency(d.value, d.currency ?? undefined)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      {recentActivities.length > 0 && (
        <div>
          <h2 className="font-serif text-base mb-2">Recent Activity</h2>
          <div className="flex flex-col gap-1.5">
            {recentActivities.map((a) => (
              <div key={a.id} className="flex items-start gap-2 py-1.5 border-b border-ks-hair/30 last:border-0">
                <span className="text-sm mt-0.5">{ACTIVITY_ICONS[a.type] ?? "\u2022"}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px]">{a.description}</span>
                </div>
                <span className="text-[10px] text-ks-faint whitespace-nowrap">
                  {a.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
