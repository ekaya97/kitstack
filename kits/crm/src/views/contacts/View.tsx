import { useKit } from "@kitstackco/sdk/view";
import { useState, useMemo } from "react";

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
type SortKey = "name" | "company" | "role" | "lastInteraction";

const WARMTH: Record<string, { dot: string; label: string }> = {
  warm: { dot: "bg-emerald-500", label: "Warm" },
  neutral: { dot: "bg-amber-500", label: "Neutral" },
  cold: { dot: "bg-[#8a8078]", label: "Cold" },
};


function relativeDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function SortHeader({
  label, field, sortBy, sortAsc, onSort,
}: {
  label: string; field: SortKey; sortBy: SortKey; sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      className="text-left px-3 py-2 text-[11px] font-medium text-[#6b6357] uppercase tracking-wider cursor-pointer hover:text-[#1a1814] transition-colors select-none"
      onClick={() => onSort(field)}
    >
      {label} {sortBy === field ? (sortAsc ? "\u2191" : "\u2193") : ""}
    </th>
  );
}

export function ContactsView() {
  const { data, loading } = useKit<Data>();
  const contacts = data ?? [];
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterRelationship, setFilterRelationship] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(true); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts
      .filter((c) => {
        const name = `${c.firstName} ${c.lastName ?? ""}`.toLowerCase();
        if (q && !name.includes(q) && !c.companyName?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q)) {
          return false;
        }
        if (filterRelationship && c.relationship !== filterRelationship) return false;
        return true;
      })
      .sort((a, b) => {
        let va = "", vb = "";
        switch (sortBy) {
          case "name": va = `${a.firstName} ${a.lastName ?? ""}`; vb = `${b.firstName} ${b.lastName ?? ""}`; break;
          case "company": va = a.companyName ?? ""; vb = b.companyName ?? ""; break;
          case "role": va = a.role ?? ""; vb = b.role ?? ""; break;
          case "lastInteraction": va = a.lastInteraction ?? ""; vb = b.lastInteraction ?? ""; break;
        }
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
  }, [contacts, search, sortBy, sortAsc, filterRelationship]);

  return (
    <div className="min-h-full bg-[#faf7f1] text-[#1a1814] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-serif text-xl tracking-tight">Contacts</h1>
        {loading && (
          <span className="text-[10px] text-[#6b6357] tracking-widest uppercase animate-pulse">
            Updating\u2026
          </span>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          type="text"
          placeholder="Search contacts\u2026"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[160px] px-3 py-2 text-sm border border-[#e8e2d9] rounded-lg bg-white placeholder:text-[#6b6357]/40 focus:outline-none focus:border-[#d65a2f]"
        />
        <div className="flex gap-1">
          {(["warm", "neutral", "cold"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRelationship(filterRelationship === r ? null : r)}
              className={`text-[10px] px-2.5 py-1.5 rounded-full border transition-colors ${
                filterRelationship === r
                  ? "border-[#1a1814] bg-[#1a1814] text-white"
                  : "border-[#e8e2d9] text-[#6b6357] hover:border-[#6b6357]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-[#e8e2d9] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f2ec] border-b border-[#e8e2d9]">
            <tr>
              <SortHeader label="Name" field="name" sortBy={sortBy} sortAsc={sortAsc} onSort={handleSort} />
              <SortHeader label="Company" field="company" sortBy={sortBy} sortAsc={sortAsc} onSort={handleSort} />
              <SortHeader label="Role" field="role" sortBy={sortBy} sortAsc={sortAsc} onSort={handleSort} />
              <th className="px-3 py-2 text-[11px] font-medium text-[#6b6357] uppercase tracking-wider w-6 text-center">&bull;</th>
              <SortHeader label="Last Contact" field="lastInteraction" sortBy={sortBy} sortAsc={sortAsc} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-[#e8e2d9]/50 hover:bg-[#f5f2ec]/40 transition-colors">
                <td className="px-3 py-2.5">
                  <span className="font-medium">{c.firstName} {c.lastName ?? ""}</span>
                  {c.email && <div className="text-[#6b6357] font-mono text-xs mt-0.5">{c.email}</div>}
                </td>
                <td className="px-3 py-2.5 text-[#6b6357]">{c.companyName ?? "\u2014"}</td>
                <td className="px-3 py-2.5 text-[#6b6357]">{c.role ?? "\u2014"}</td>
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${WARMTH[c.relationship ?? "neutral"]?.dot ?? WARMTH.neutral.dot}`}
                    title={WARMTH[c.relationship ?? "neutral"]?.label ?? "Neutral"}
                  />
                </td>
                <td className="px-3 py-2.5 text-[#6b6357] text-xs">{relativeDate(c.lastInteraction)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[#6b6357]/40">
                  {search || filterRelationship ? "No contacts match your search" : "No contacts yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] text-[#6b6357]/60">
        {filtered.length} of {contacts.length} contacts
      </div>
    </div>
  );
}
