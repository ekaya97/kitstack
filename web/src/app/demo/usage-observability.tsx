import { useState } from "react";

export type UsageEvent = {
  id: string;
  timestamp: string;
  appId?: string | null;
  sessionId?: string | null;
  customerId?: string | null;
  pluginId?: string | null;
  kitId?: string | null;
  channel: string;
  type: string;
  operation: string;
  model?: string | null;
  provider?: string | null;
  requestTokens?: number | null;
  responseTokens?: number | null;
  latencyMs?: number | null;
  estimatedCostUsd?: number | null;
  outcome: string;
  parentId?: string | null;
  traceId?: string | null;
  instructionVersions?: string[];
  memoryIds?: string[];
};

export type UsageCustomer = { id: string; company: string; contactName: string };
type FilterName = "appId" | "kitId" | "pluginId" | "customerId" | "sessionId";

export function buildTraceTree(events: UsageEvent[]) {
  const byParent = new Map<string | null, UsageEvent[]>();
  for (const event of events) {
    const parent = event.parentId && events.some((candidate) => candidate.id === event.parentId) ? event.parentId : null;
    const siblings = byParent.get(parent) ?? [];
    siblings.push(event);
    byParent.set(parent, siblings);
  }
  const result: Array<{ event: UsageEvent; depth: number }> = [];
  const visit = (parent: string | null, depth: number) => {
    for (const event of byParent.get(parent) ?? []) {
      result.push({ event, depth });
      visit(event.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

export function UsageObservabilityView({ events, customers }: { events: UsageEvent[]; customers: UsageCustomer[] }) {
  const [filters, setFilters] = useFilterState();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const options = (field: FilterName) => [...new Set(events.map((event) => event[field]).filter((value): value is string => Boolean(value)))];
  const filtered = events.filter((event) => Object.entries(filters).every(([field, value]) => value === "all" || event[field as FilterName] === value))
    .filter((event) => !from || event.timestamp >= new Date(from).toISOString())
    .filter((event) => !to || event.timestamp < new Date(to).toISOString());
  const totals = filtered.reduce((sum, event) => ({ request: sum.request + (event.requestTokens ?? 0), response: sum.response + (event.responseTokens ?? 0), cost: sum.cost + (event.estimatedCostUsd ?? 0), latency: sum.latency + (event.latencyMs ?? 0) }), { request: 0, response: 0, cost: 0, latency: 0 });
  const appRollup = rollup(filtered, (event) => event.appId ?? "boot");
  const sessionRollup = rollup(filtered, (event) => event.sessionId ?? "not assigned");
  const trace = buildTraceTree(filtered.filter((event) => event.sessionId === filters.sessionId || filters.sessionId === "all"));
  return <section aria-label="Usage, observability, and FinOps">
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6"><Metric label="Events" value={filtered.length} /><Metric label="Proxy requests" value={filtered.filter((event) => event.channel === "proxy").length} /><Metric label="Tokens" value={(totals.request + totals.response).toLocaleString()} /><Metric label="Latency" value={`${totals.latency.toLocaleString()} ms`} /><Metric label="Est. cost" value={`$${totals.cost.toFixed(4)}`} /><Metric label="Errors" value={filtered.filter((event) => event.outcome === "error").length} /></div>
    <div className="ks-card mb-5 flex flex-wrap gap-2 p-4">{([ ["App", "appId"], ["Kit", "kitId"], ["Plugin", "pluginId"], ["Customer", "customerId"], ["Session", "sessionId"] ] as const).map(([label, field]) => <label key={field} className="text-[10px] text-ks-muted">{label}<select aria-label={`Filter by ${label}`} className="ks-input mt-1 min-w-[135px] !py-1.5" value={filters[field]} onChange={(event) => setFilters({ ...filters, [field]: event.target.value })}><option value="all">All</option>{field === "customerId" ? customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.company}</option>) : options(field).map((item) => <option key={item}>{item}</option>)}</select></label>)}<label className="text-[10px] text-ks-muted">From<input aria-label="Filter from" type="datetime-local" className="ks-input mt-1 !py-1.5" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="text-[10px] text-ks-muted">To<input aria-label="Filter to" type="datetime-local" className="ks-input mt-1 !py-1.5" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]"><div className="ks-card overflow-x-auto"><div className="border-b border-ks-hair p-5"><h2 className="font-serif text-[24px]">Usage / Observability / FinOps</h2><p className="mt-1 text-[12px] text-ks-muted">Proxy requests and runtime evidence, with content deliberately excluded.</p></div>{filtered.length === 0 ? <div className="p-8"><Empty title="No matching usage" detail="Run the prebrief and debrief flow, or change the filters." /></div> : <table className="w-full text-left text-[11px]"><caption className="sr-only">Metadata-only usage events</caption><thead className="border-b border-ks-hair bg-ks-paper-warm text-ks-muted"><tr>{["Time", "Request", "Identity", "Usage", "Provider", "Refs", "Outcome"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-2 font-medium">{heading}</th>)}</tr></thead><tbody>{filtered.map((event) => <tr key={event.id} className="border-b border-ks-hair/50"><td className="whitespace-nowrap px-3 py-3 font-mono text-[10px]">{new Date(event.timestamp).toLocaleTimeString()}</td><td className="px-3 py-3"><span className="font-medium">{event.operation}</span><div className="text-[9px] text-ks-muted">{event.type} · {event.channel}</div></td><td className="px-3 py-3 font-mono text-[10px]">{event.appId ?? "boot"}<div className="text-[9px] text-ks-muted">{event.customerId ?? "no customer"} · {event.sessionId ?? "no session"}</div></td><td className="px-3 py-3 font-mono text-[10px]">{tokens(event)} tokens<div>{event.latencyMs == null ? "—" : `${event.latencyMs} ms`} · {event.estimatedCostUsd == null ? "—" : `$${event.estimatedCostUsd.toFixed(4)}`}</div></td><td className="px-3 py-3">{event.provider ?? "Not reported"}<div className="font-mono text-[9px] text-ks-muted">{event.model ?? "model not reported"}</div></td><td className="max-w-[180px] px-3 py-3 font-mono text-[9px] text-ks-muted">{[...(event.memoryIds ?? []), ...(event.instructionVersions ?? [])].join(" · ") || "none"}</td><td className="px-3 py-3"><span className={`ks-chip !text-[9px] ${event.outcome === "error" ? "!text-red-700" : ""}`}>{event.outcome}</span></td></tr>)}</tbody></table>}</div><div className="space-y-5"><Rollup title="Cost by app" rows={appRollup} /><Rollup title="Cost by session" rows={sessionRollup} /></div></div>
    <div className="ks-card mt-5 p-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="font-serif text-[24px]">Trace tree</h2><p className="mt-1 text-[12px] text-ks-muted">Prebrief → scheduled call → confirmation, represented by trace and parent metadata.</p></div><span className="font-mono text-[10px] text-ks-muted">{trace.length} nodes</span></div>{trace.length === 0 ? <div className="mt-4"><Empty title="No trace for the selected filters" detail="Select a session or run the customer flow to see its metadata tree." /></div> : <div className="mt-4 space-y-3">{trace.map(({ event, depth }) => <div key={event.id} className="flex gap-3 rounded-lg border border-ks-hair p-3" style={{ marginLeft: `${Math.min(depth, 5) * 18}px` }}><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-ks-accent" /><div className="min-w-0"><div className="flex flex-wrap items-baseline gap-2"><span className="font-medium">{traceLabel(event.operation)}</span><span className="ks-chip !text-[9px]">{event.type}</span><span className="font-mono text-[10px] text-ks-muted">{new Date(event.timestamp).toLocaleTimeString()}</span></div><div className="mt-1 font-mono text-[9px] text-ks-muted">trace: {event.traceId ?? "—"} · parent: {event.parentId ?? "root"} · {event.outcome}</div></div></div>)}</div>}</div>
  </section>;
}

function useFilterState(): [{ appId: string; kitId: string; pluginId: string; customerId: string; sessionId: string }, (value: { appId: string; kitId: string; pluginId: string; customerId: string; sessionId: string }) => void] {
  // Kept local to the presenter surface so the legacy Usage and Trace tabs do not change behavior.
  return useState({ appId: "all", kitId: "all", pluginId: "all", customerId: "all", sessionId: "all" });
}
function rollup(events: UsageEvent[], key: (event: UsageEvent) => string) { const map = new Map<string, { events: number; tokens: number; cost: number }>(); for (const event of events) { const id = key(event); const row = map.get(id) ?? { events: 0, tokens: 0, cost: 0 }; row.events += 1; row.tokens += tokens(event); row.cost += event.estimatedCostUsd ?? 0; map.set(id, row); } return [...map].map(([id, row]) => ({ id, ...row })).sort((a, b) => b.cost - a.cost); }
function Rollup({ title, rows }: { title: string; rows: Array<{ id: string; events: number; tokens: number; cost: number }> }) { return <div className="ks-card p-5"><h2 className="font-serif text-[21px]">{title}</h2>{rows.length === 0 ? <p className="mt-3 text-[11px] text-ks-muted">No rollup data.</p> : <div className="mt-3 space-y-2">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-2 border-b border-ks-hair/60 pb-2 text-[11px]"><span className="min-w-0 truncate font-mono text-[10px]">{row.id}</span><span className="shrink-0 text-right font-mono text-[10px]">${row.cost.toFixed(4)}<span className="ml-2 text-ks-muted">{row.tokens} tok · {row.events} ev</span></span></div>)}</div>}</div>; }
function tokens(event: UsageEvent) { return (event.requestTokens ?? 0) + (event.responseTokens ?? 0) || 0; }
function traceLabel(operation: string) { if (operation === "prebrief") return "Prebrief"; if (operation.includes("schedul")) return "Scheduled call"; if (operation === "complete" || operation === "confirmed" || operation === "call_completed") return "Confirmation"; return operation; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="ks-card p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-ks-muted">{label}</div><div className="mt-1 font-serif text-[25px]">{value}</div></div>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="ks-card p-6 text-center"><h2 className="font-serif text-[20px]">{title}</h2><p className="mt-1 text-[11px] text-ks-muted">{detail}</p></div>; }
