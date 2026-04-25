import { useState } from "react";
import { useKit, useTool, useFile } from "../../sdk-view";
import type { LoaderData } from "../../sdk";
import type contactsView from "./index";

type Data = LoaderData<typeof contactsView>;

export function ContactsView() {
  const { data, reload } = useKit<Data>();
  const file = useFile();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "company" | "dealCount">("name");

  const filtered = data.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company?.toLowerCase().includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "dealCount") return (b.dealCount ?? 0) - (a.dealCount ?? 0);
    const av = a[sortBy] ?? "";
    const bv = b[sortBy] ?? "";
    return av.localeCompare(bv);
  });

  const handleExport = () => {
    const csv =
      "name,company,email,source,deals\n" +
      sorted.map((c) => `"${c.name}","${c.company ?? ""}","${c.email ?? ""}","${c.source ?? ""}","${c.dealCount}"`).join("\n");
    file.download("contacts.csv", "text/csv", csv);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-serif text-xl">Contacts</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-ks-hair rounded px-2 py-1 text-sm"
          />
          <button onClick={handleExport} className="border border-ks-hair rounded px-2 py-1 text-sm text-ks-muted hover:bg-ks-paper-warm">
            Export CSV
          </button>
        </div>
      </div>

      <div className="text-xs text-ks-muted mb-2">
        {filtered.length} of {data.length} contacts
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ks-hair text-left text-ks-muted">
            <th className="py-2 cursor-pointer" onClick={() => setSortBy("name")}>Name</th>
            <th className="py-2 cursor-pointer" onClick={() => setSortBy("company")}>Company</th>
            <th className="py-2">Email</th>
            <th className="py-2">Source</th>
            <th className="py-2 cursor-pointer" onClick={() => setSortBy("dealCount")}>Deals</th>
            <th className="py-2">Last Contacted</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id} className="border-b border-ks-hair/50 hover:bg-ks-paper-warm cursor-pointer">
              <td className="py-2 font-medium">{c.name}</td>
              <td className="py-2 text-ks-muted">{c.company ?? "—"}</td>
              <td className="py-2 text-ks-muted">{c.email ?? "—"}</td>
              <td className="py-2 text-ks-muted">{c.source ?? "—"}</td>
              <td className="py-2 font-mono">{c.dealCount}</td>
              <td className="py-2 text-ks-muted">{c.lastContactedAt ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {file.feedback && (
        <div className="fixed bottom-4 right-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-3 py-2 text-sm">
          {file.feedback}
        </div>
      )}
    </div>
  );
}
