import { useKit } from "@kitstackco/sdk/view";

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  relationship: string | null;
  source: string | null;
  notes: string | null;
  companyName: string | null;
};

type Deal = {
  id: string;
  title: string;
  stage: string | null;
  valueCents: number | null;
  currency: string | null;
};

type Activity = {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
};

type Data = { contact: Contact; deals: Deal[]; activities: Activity[] } | null;

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-ks-paper-deep text-ks-ink",
  contacted: "bg-blue-50 text-blue-800",
  proposal: "bg-blue-50 text-blue-800",
  negotiation: "bg-amber-50 text-amber-800",
  won: "bg-emerald-50 text-emerald-800",
  lost: "bg-red-50 text-red-800",
};

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", contacted: "Contacted", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
};

const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞", email: "✉️", meeting: "🤝", coffee: "☕",
  linkedin: "🔗", event: "🌟", note: "📝", task: "☑️",
};

function formatCurrency(value: number | null, currency = "EUR"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(value / 100);
}

export function ContactDetailView() {
  const { data } = useKit<Data>();

  if (!data) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[200px] gap-2">
        <p className="text-ks-muted text-xs">No contact selected</p>
      </div>
    );
  }

  const { contact, deals, activities } = data;
  const name = `${contact.firstName} ${contact.lastName ?? ""}`.trim();

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">{name}</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>

      {/* Header card */}
      <div className="bg-ks-paper-warm rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {contact.companyName && (
            <div>
              <span className="text-ks-faint text-[10px] uppercase tracking-wider">Company</span>
              <div className="font-medium">{contact.companyName}</div>
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
                  <div className="font-medium text-[13px]">{d.title}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${STAGE_COLORS[d.stage ?? "lead"]}`}>
                    {STAGE_LABELS[d.stage ?? "lead"]}
                  </span>
                </div>
                <span className="font-mono text-sm font-medium text-ks-accent">
                  {formatCurrency(d.valueCents, d.currency ?? "EUR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      {activities.length > 0 && (
        <div>
          <h2 className="font-serif text-base mb-2">Recent Activity</h2>
          <div className="flex flex-col gap-1.5">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-2 py-1.5 border-b border-ks-hair/30 last:border-0">
                <span className="text-sm mt-0.5">{ACTIVITY_ICONS[a.type] ?? "•"}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px]">{a.summary}</span>
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
