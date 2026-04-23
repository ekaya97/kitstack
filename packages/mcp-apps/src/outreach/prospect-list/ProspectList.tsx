import { useState, useMemo } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData } from "@shared/use-app-data";
import { PROSPECT_STATUS_COLORS, type Prospect, type ProspectStatus } from "@shared/types";

const STATUS_ORDER: ProspectStatus[] = ["new", "contacted", "replied", "converted"];

export function ProspectList() {
  const { data: prospects, loading, error, refetch } = useAppData<Prospect>("prospects");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ProspectStatus | "all">("all");

  const filtered = useMemo(() => {
    if (!prospects) return [];
    const q = search.toLowerCase();
    return prospects
      .filter((p) => {
        if (filterStatus !== "all" && p.status !== filterStatus) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.company.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.status);
        const bi = STATUS_ORDER.indexOf(b.status);
        return ai - bi;
      });
  }, [prospects, search, filterStatus]);

  return (
    <AppShell title="Prospect List" loading={loading} error={error} onRetry={refetch}>
      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-3">
        <input
          type="text"
          placeholder="Search prospects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-ks-hair rounded-lg bg-white placeholder:text-ks-faint focus:outline-none focus:border-ks-accent"
        />
        <div className="flex gap-1">
          {(["all", ...STATUS_ORDER] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors ${
                filterStatus === s
                  ? "border-ks-accent bg-ks-accent-soft text-ks-accent-deep"
                  : "border-ks-hair hover:bg-ks-paper-warm text-ks-muted"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-ks-hair rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ks-paper-warm border-b border-ks-hair">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Name</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Company</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Email</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">LinkedIn</th>
              <th className="text-left px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Status</th>
              <th className="text-center px-3 py-2 text-[11px] font-medium text-ks-muted uppercase tracking-wider">Hooks</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.id}
                className="border-b border-ks-hair/50 hover:bg-ks-paper-warm/40 transition-colors"
              >
                <td className="px-3 py-2.5 font-medium">{p.name}</td>
                <td className="px-3 py-2.5 text-ks-muted">{p.company}</td>
                <td className="px-3 py-2.5 text-ks-muted font-mono text-xs">{p.email}</td>
                <td className="px-3 py-2.5">
                  {p.linkedin ? (
                    <a
                      href={p.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Profile
                    </a>
                  ) : (
                    <span className="text-ks-faint text-xs">&mdash;</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PROSPECT_STATUS_COLORS[p.status]}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="font-mono text-xs text-ks-muted" title={p.personalization_hooks.join(", ")}>
                    {p.personalization_hooks.length}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ks-faint">
                  {search || filterStatus !== "all" ? "No prospects match your filters" : "No prospects yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] text-ks-faint">
        {filtered.length} of {prospects?.length ?? 0} prospects
      </div>
    </AppShell>
  );
}
