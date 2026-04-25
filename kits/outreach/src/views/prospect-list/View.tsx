import { useState, useMemo } from "react";
import type { Infer } from "../../sdk";
import type { loader } from "./loader";

type Data = Infer<typeof loader>;
type Prospect = Data[number];

function parseHooks(raw?: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function ProspectListView({ data }: { data: Data }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.company || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <h1 className="font-serif text-xl">Prospect List</h1>
        <div className="flex-1" />
        <input
          type="text"
          placeholder="Search prospects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 text-sm border border-ks-hair rounded-lg bg-white placeholder:text-ks-faint focus:outline-none focus:border-ks-accent"
        />
      </div>

      <div className="border border-ks-hair rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ks-paper-warm border-b border-ks-hair">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">
                Company
              </th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">
                Email
              </th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">
                Status
              </th>
              <th className="text-center px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">
                Hooks
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const hooks = parseHooks(p.personalizationHooks);
              const hookCount = Object.keys(hooks).length;
              return (
                <tr
                  key={p.id}
                  className="border-b border-ks-hair/50 hover:bg-ks-paper-warm/40 transition-colors"
                >
                  <td className="px-3 py-2.5 font-medium">{p.name}</td>
                  <td className="px-3 py-2.5 text-ks-muted">
                    {p.company || "\u2014"}
                  </td>
                  <td className="px-3 py-2.5 text-ks-muted font-mono text-xs">
                    {p.email || "\u2014"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-ks-paper-deep text-ks-muted">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className="font-mono text-xs text-ks-muted"
                      title={Object.entries(hooks)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")}
                    >
                      {hookCount}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-ks-faint"
                >
                  {search
                    ? "No prospects match your search"
                    : "No prospects yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] text-ks-faint">
        {filtered.length} of {data.length} prospects
      </div>
    </div>
  );
}
