import { useState, useMemo } from "react";
import { useKit } from "@kitstackco/sdk/view";

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  role: string | null;
  relationship: string | null;
  tags: string | null;
  companyName: string | null;
  lastInteraction: string | null;
};

type Data = Contact[];
type SortKey = "name" | "company" | "email" | "source" | "last_contacted_at";

export function ContactsView() {
  const { data } = useKit<Data>();
  const contacts = data ?? [];
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts
      .filter(
        (c) =>
          !q ||
          `${c.firstName} ${c.lastName ?? ""}`.toLowerCase().includes(q) ||
          c.companyName?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        let va = "", vb = "";
        switch (sortBy) {
          case "name": va = `${a.firstName} ${a.lastName ?? ""}`; vb = `${b.firstName} ${b.lastName ?? ""}`; break;
          case "company": va = a.companyName ?? ""; vb = b.companyName ?? ""; break;
          case "email": va = a.email ?? ""; vb = b.email ?? ""; break;
          case "source": va = a.relationship ?? ""; vb = b.relationship ?? ""; break;
          case "last_contacted_at": va = a.lastInteraction ?? ""; vb = b.lastInteraction ?? ""; break;
        }
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

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl text-ks-ink">Contacts</h1>
        <span className="font-mono text-[10px] text-ks-faint tracking-wider">KITSTACK</span>
      </div>
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
              >
                <td className="px-3 py-2.5 font-medium">{c.firstName} {c.lastName ?? ""}</td>
                <td className="px-3 py-2.5 text-ks-muted">{c.companyName || "—"}</td>
                <td className="px-3 py-2.5 text-ks-muted font-mono text-xs">{c.email || "—"}</td>
                <td className="px-3 py-2.5">
                  {c.relationship && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-ks-paper-deep text-ks-ink">
                      {c.relationship}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-ks-muted text-xs">{c.lastInteraction || "Never"}</td>
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
    </div>
  );
}
