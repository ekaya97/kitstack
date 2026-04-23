import { useState, useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData, getToken, getParam } from "@shared/use-app-data";
import type { Contact } from "@shared/types";

type SortKey = "name" | "company" | "email" | "source" | "last_contacted_at";

export function ContactsTable() {
  const { data: contacts, loading, error, refetch } = useAppData<Contact>("contacts");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const q = search.toLowerCase();
    return contacts
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const va = (a[sortBy] ?? "") as string;
        const vb = (b[sortBy] ?? "") as string;
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
  }, [contacts, search, sortBy, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else {
      setSortBy(key);
      setSortAsc(true);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider cursor-pointer hover:text-ks-ink transition-colors"
      onClick={() => handleSort(field)}
    >
      {label} {sortBy === field ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  const token = getToken();
  const kit = getParam("kit") || "crm";

  return (
    <AppShell title="Contacts" loading={loading} error={error} onRetry={refetch}>
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-ks-hair rounded-lg bg-white placeholder:text-ks-faint focus:outline-none focus:border-ks-accent"
        />
      </div>
      <div className="border border-ks-hair rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ks-paper-warm border-b border-ks-hair">
            <tr>
              <SortHeader label="Name" field="name" />
              <SortHeader label="Company" field="company" />
              <SortHeader label="Email" field="email" />
              <SortHeader label="Source" field="source" />
              <SortHeader label="Last Contact" field="last_contacted_at" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-b border-ks-hair/50 hover:bg-ks-paper-warm/40 cursor-pointer transition-colors"
                onClick={() => {
                  window.location.href = `../contact-detail/?token=${token}&kit=${kit}&contactId=${c.id}`;
                }}
              >
                <td className="px-3 py-2.5 font-medium">{c.name}</td>
                <td className="px-3 py-2.5 text-ks-muted">{c.company || "—"}</td>
                <td className="px-3 py-2.5 text-ks-muted font-mono text-xs">{c.email || "—"}</td>
                <td className="px-3 py-2.5">
                  {c.source && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-ks-paper-deep text-ks-ink">
                      {c.source}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-ks-muted text-xs">{c.last_contacted_at || "Never"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ks-faint">
                  {search ? "No contacts match your search" : "No contacts yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] text-ks-faint">
        {filtered.length} of {contacts?.length ?? 0} contacts
      </div>
    </AppShell>
  );
}
