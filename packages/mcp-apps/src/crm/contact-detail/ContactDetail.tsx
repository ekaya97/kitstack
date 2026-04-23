import { useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData, getParam } from "@shared/use-app-data";
import { STAGE_COLORS, STAGE_LABELS, type Contact, type Deal, type Activity } from "@shared/types";

function formatCurrency(value: number | null, currency = "EUR"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(value);
}

const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞",
  email: "✉️",
  meeting: "🤝",
  note: "📝",
  task: "☑️",
};

export function ContactDetail() {
  const contactId = getParam("contactId") || (import.meta.env.DEV ? "c1" : null);
  const { data: contacts, loading: cl, error: ce, refetch } = useAppData<Contact>("contacts");
  const { data: deals, loading: dl } = useAppData<Deal>("deals");
  const { data: activities, loading: al } = useAppData<Activity>("activities");

  const loading = cl || dl || al;

  const contact = useMemo(
    () => contacts?.find((c) => c.id === contactId) ?? null,
    [contacts, contactId]
  );

  const contactDeals = useMemo(
    () => deals?.filter((d) => d.contact_id === contactId) ?? [],
    [deals, contactId]
  );

  const contactActivities = useMemo(
    () =>
      activities
        ?.filter((a) => a.contact_id === contactId)
        .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
        .slice(0, 15) ?? [],
    [activities, contactId]
  );

  if (!contactId) {
    return <AppShell title="Contact" error="No contact ID provided" />;
  }

  if (!loading && !contact) {
    return <AppShell title="Contact" error="Contact not found" onRetry={refetch} />;
  }

  return (
    <AppShell title={contact?.name ?? "Contact"} loading={loading} error={ce} onRetry={refetch}>
      {contact && (
        <>
          {/* Header */}
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
          {contactDeals.length > 0 && (
            <div className="mb-4">
              <h2 className="font-serif text-base mb-2">Deals ({contactDeals.length})</h2>
              <div className="flex flex-col gap-2">
                {contactDeals.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 border border-ks-hair rounded-lg">
                    <div>
                      <div className="font-medium text-[13px]">{d.name}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${STAGE_COLORS[d.stage]}`}>
                        {STAGE_LABELS[d.stage]}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-medium text-ks-accent">
                      {formatCurrency(d.value, d.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          {contactActivities.length > 0 && (
            <div>
              <h2 className="font-serif text-base mb-2">Recent Activity</h2>
              <div className="flex flex-col gap-1.5">
                {contactActivities.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 py-1.5 border-b border-ks-hair/30 last:border-0">
                    <span className="text-sm mt-0.5">{ACTIVITY_ICONS[a.type] ?? "•"}</span>
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
        </>
      )}
    </AppShell>
  );
}
