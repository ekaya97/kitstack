import { useState, useMemo } from "react";
import { useFile } from "../../sdk-view";
import type { Infer } from "../../sdk";
import type { loader } from "./loader";

type SortKey = "name" | "company" | "email" | "source" | "lastContactedAt";

export function ContactsView({ data }: { data: Infer<typeof loader> }) {
  const file = useFile();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data
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
  }, [data, search, sortBy, sortAsc]);

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
      {label} {sortBy === field ? (sortAsc ? "\u2191" : "\u2193") : ""}
    </th>
  );

  const handleExport = () => {
    const csv =
      "name,company,email,source\n" +
      filtered.map((c) => `"${c.name}","${c.company ?? ""}","${c.email ?? ""}","${c.source ?? ""}"`).join("\n");
    file.download("contacts.csv", "text/csv", csv);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-serif text-xl">Contacts</h1>
        <button
          onClick={handleExport}
          className="border border-ks-hair rounded-lg px-3 py-1.5 text-xs text-ks-muted hover:bg-ks-paper-warm transition-colors"
        >
          Export CSV
        </button>
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
              <SortHeader label="Last Contact" field="lastContactedAt" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-b border-ks-hair/50 hover:bg-ks-paper-warm/40 cursor-pointer transition-colors"
              >
                <td className="px-3 py-2.5 font-medium">{c.name}</td>
                <td className="px-3 py-2.5 text-ks-muted">{c.company || "\u2014"}</td>
                <td className="px-3 py-2.5 text-ks-muted font-mono text-xs">{c.email || "\u2014"}</td>
                <td className="px-3 py-2.5">
                  {c.source && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-ks-paper-deep text-ks-ink">
                      {c.source}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-ks-muted text-xs">{c.lastContactedAt || "Never"}</td>
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
        {filtered.length} of {data.length} contacts
      </div>

      {file.feedback && (
        <div className="fixed bottom-4 right-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg px-3 py-2 text-sm">
          {file.feedback}
        </div>
      )}
    </div>
  );
}
