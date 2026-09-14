"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Tab = "apps" | "usage" | "trace";
type Event = {
  id: string;
  timestamp: string;
  orgId: string;
  appId: string | null;
  sessionId?: string | null;
  parentId?: string | null;
  traceId?: string | null;
  channel: string;
  pluginId?: string | null;
  kitId?: string | null;
  type: string;
  operation: string;
  model?: string | null;
  requestTokens?: number | null;
  responseTokens?: number | null;
  latencyMs?: number | null;
  estimatedCostUsd?: number | null;
  outcome: string;
  instructionVersions?: string[];
  memoryIds?: string[];
};
type Aggregate = {
  totalEvents: number;
  totalRequestTokens: number;
  totalResponseTokens: number;
  totalEstimatedCostUsd: number;
  totalLatencyMs: number;
  successCount: number;
  errorCount: number;
};
type App = { id: string; name: string; org: string; scopes: string[]; createdAt: string; token?: string; expiresAt?: string };

const API = process.env.NEXT_PUBLIC_DEMO_API_URL || "http://localhost:3001";
const tabs: { id: Tab; label: string }[] = [
  { id: "apps", label: "Apps" },
  { id: "usage", label: "Usage" },
  { id: "trace", label: "Session Trace" },
];

export default function DemoPage() {
  const [tab, setTab] = useState<Tab>("apps");
  const [events, setEvents] = useState<Event[]>([]);
  const [aggregate, setAggregate] = useState<Aggregate | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/demo/observability?limit=1000`);
      if (!response.ok) throw new Error(`Observability request failed (${response.status})`);
      const data = await response.json() as { events?: Event[]; aggregate?: Aggregate };
      setEvents(data.events ?? []);
      setAggregate(data.aggregate ?? null);
      if (!selectedSession && data.events?.length) {
        const first = data.events.find((event) => event.sessionId)?.sessionId;
        if (first) setSelectedSession(first);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to the demo API.");
    } finally {
      setLoading(false);
    }
  }, [selectedSession]);

  useEffect(() => { void load(); }, [load]);

  async function reset() {
    if (!window.confirm("Clear demo sessions, memory, and telemetry?")) return;
    setNotice("");
    try {
      const response = await fetch(`${API}/api/demo/reset`, { method: "POST", headers: { "x-demo-reset-token": "demo-reset" } });
      if (!response.ok) throw new Error(`Reset failed (${response.status})`);
      setSelectedSession("");
      setNotice("Demo data cleared. App registrations and tokens were preserved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reset the demo.");
    }
  }

  const sessions = useMemo(() => [...new Set(events.map((event) => event.sessionId).filter((id): id is string => Boolean(id)))], [events]);

  return (
    <main className="min-h-screen bg-ks-paper px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-ks-hair pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-ks-accent">KitStack / unreleased demo</div>
            <h1 className="mt-2 font-serif text-[38px] leading-none tracking-tight">Developer observability</h1>
            <p className="mt-2 max-w-xl text-[14px] text-ks-muted">Watch the debrief agent learn across a prebrief, voice call, and replay.</p>
          </div>
          <button onClick={reset} className="ks-btn !px-4 !py-2 !text-[12px]">Reset demo</button>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`ks-btn !rounded-lg !px-3 !py-2 !text-[12px] ${tab === item.id ? "!border-ks-ink !bg-ks-ink !text-white" : ""}`}>{item.label}</button>)}
          <span className="ml-auto font-mono text-[10px] text-ks-muted">API {API}</span>
        </div>

        <div className="mb-6 rounded-xl border border-ks-accent/30 bg-ks-accent-soft px-4 py-3 text-[12px] text-ks-accent-deep">
          Demo access is auth-none for local use and public tunnels. Never use this surface with production data or real secrets.
        </div>
        {notice && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[12px] text-green-800">{notice}</div>}
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">{error} <button className="ml-2 underline" onClick={() => void load()}>Retry</button></div>}
        {loading ? <Loading /> : tab === "apps" ? <AppsView apps={apps} events={events} setApps={setApps} /> : tab === "usage" ? <UsageView events={events} aggregate={aggregate} /> : <TraceView events={events} sessions={sessions} selectedSession={selectedSession} setSelectedSession={setSelectedSession} />}
      </div>
    </main>
  );
}

function AppsView({ apps, events, setApps }: { apps: App[]; events: Event[]; setApps: (apps: App[]) => void }) {
  const [name, setName] = useState("Sales voice demo");
  const [scopes, setScopes] = useState("inference, mcp");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function register(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/v1/apps/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, org: "org-demo", scopes: scopes.split(",").map((scope) => scope.trim()).filter(Boolean) }) });
      if (!response.ok) throw new Error(`Registration failed (${response.status})`);
      const app = await response.json() as App;
      const tokenResponse = await fetch(`${API}/v1/apps/${encodeURIComponent(app.id)}/token`, { method: "POST" });
      if (!tokenResponse.ok) throw new Error(`Token issuance failed (${tokenResponse.status})`);
      const token = await tokenResponse.json() as { token: string; expiresInSeconds: number };
      setApps([{ ...app, token: token.token, expiresAt: new Date(Date.now() + token.expiresInSeconds * 1000).toISOString() }, ...apps]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not register app."); }
    finally { setBusy(false); }
  }
  return <section className="grid gap-5 lg:grid-cols-[300px_1fr]">
    <form onSubmit={register} className="ks-card h-fit p-5"><h2 className="font-serif text-[24px]">Register an app</h2><p className="mt-1 mb-4 text-[12px] text-ks-muted">Issue a short-lived developer token for the demo proxy.</p><label className="mb-3 block text-[11px] text-ks-muted">Name<input className="ks-input mt-1" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="mb-4 block text-[11px] text-ks-muted">Scopes<input className="ks-input mt-1" value={scopes} onChange={(event) => setScopes(event.target.value)} /></label>{error && <p className="mb-3 text-[11px] text-red-700">{error}</p>}<button disabled={busy} className="ks-btn ks-btn-primary w-full justify-center !py-2 !text-[12px]">{busy ? "Registering…" : "Register + issue token"}</button></form>
    <div className="space-y-3">{apps.length === 0 ? <Empty title="No apps in this browser session" detail="Register the app Claude or your local caller will use." /> : apps.map((app) => <AppCard key={app.id} app={app} eventCount={events.filter((event) => event.appId === app.id).length} />)}</div>
  </section>;
}

function AppCard({ app, eventCount }: { app: App; eventCount: number }) {
  const [revealed, setRevealed] = useState(false);
  return <article className="ks-card p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-sans text-[15px] font-semibold">{app.name}</h3><p className="font-mono text-[10px] text-ks-muted">{app.id} · {app.org}</p></div><span className="ks-chip ks-chip-soft">auth-none demo</span></div><div className="mt-4 grid gap-3 text-[12px] sm:grid-cols-3"><div><div className="text-ks-muted">Scopes</div><div className="mt-1 flex flex-wrap gap-1">{app.scopes.map((scope) => <span key={scope} className="ks-chip !text-[10px]">{scope}</span>)}</div></div><div><div className="text-ks-muted">Token expires</div><div className="mt-1 font-mono text-[11px]">{app.expiresAt ? new Date(app.expiresAt).toLocaleString() : "—"}</div></div><div><div className="text-ks-muted">Events</div><div className="mt-1 font-mono">{eventCount}</div></div></div>{app.token && <div className="mt-4 rounded-lg bg-ks-paper-warm p-3"><div className="mb-2 text-[11px] text-ks-muted">Token shown only here; it is not stored in localStorage.</div><code className="block break-all font-mono text-[10px]">{revealed ? app.token : `${app.token.slice(0, 12)}••••••••••••`}</code><button onClick={() => setRevealed(!revealed)} className="mt-2 text-[11px] text-ks-accent underline">{revealed ? "Mask token" : "Reveal token once"}</button></div>}</article>;
}

function UsageView({ events, aggregate }: { events: Event[]; aggregate: Aggregate | null }) {
  const [app, setApp] = useState("all"); const [channel, setChannel] = useState("all"); const [plugin, setPlugin] = useState("all"); const [kit, setKit] = useState("all");
  const options = (field: "appId" | "channel" | "pluginId" | "kitId") => [...new Set(events.map((event) => event[field]).filter((value): value is string => Boolean(value)))];
  const filtered = events.filter((event) => (app === "all" || event.appId === app) && (channel === "all" || event.channel === channel) && (plugin === "all" || event.pluginId === plugin) && (kit === "all" || event.kitId === kit));
  const totals = filtered.reduce((sum, event) => ({ tokens: sum.tokens + (event.requestTokens ?? 0) + (event.responseTokens ?? 0), cost: sum.cost + (event.estimatedCostUsd ?? 0), latency: sum.latency + (event.latencyMs ?? 0), errors: sum.errors + (event.outcome === "error" ? 1 : 0) }), { tokens: 0, cost: 0, latency: 0, errors: 0 });
  const filters: { label: string; value: string; setValue: (value: string) => void; field: "appId" | "channel" | "pluginId" | "kitId" }[] = [
    { label: "App", value: app, setValue: setApp, field: "appId" },
    { label: "Channel", value: channel, setValue: setChannel, field: "channel" },
    { label: "Plugin", value: plugin, setValue: setPlugin, field: "pluginId" },
    { label: "Kit", value: kit, setValue: setKit, field: "kitId" },
  ];
  return <section><div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5"><Metric label="Events" value={filtered.length} /><Metric label="Tokens" value={totals.tokens.toLocaleString()} /><Metric label="Cost" value={`$${totals.cost.toFixed(4)}`} /><Metric label="Latency" value={`${totals.latency.toLocaleString()} ms`} /><Metric label="Errors" value={totals.errors} /></div><div className="ks-card mb-5 flex flex-wrap gap-2 p-4">{filters.map((filter) => <label key={filter.field} className="text-[10px] text-ks-muted">{filter.label}<select className="ks-input mt-1 min-w-[125px] !py-1.5" value={filter.value} onChange={(event) => filter.setValue(event.target.value)}><option value="all">All</option>{options(filter.field).map((item) => <option key={item}>{item}</option>)}</select></label>)}</div>{filtered.length === 0 ? <Empty title="No usage events" detail="Run the prebrief and debrief flow to populate this view." /> : <div className="ks-card overflow-x-auto"><table className="w-full text-left text-[11px]"><thead className="border-b border-ks-hair bg-ks-paper-warm text-ks-muted"><tr>{["Time", "Operation", "App", "Channel", "Plugin / kit", "Tokens", "Outcome"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-2 font-medium">{heading}</th>)}</tr></thead><tbody>{filtered.map((event) => <tr key={event.id} className="border-b border-ks-hair/50"><td className="whitespace-nowrap px-3 py-2 font-mono text-[10px]">{new Date(event.timestamp).toLocaleTimeString()}</td><td className="px-3 py-2">{event.operation}<div className="text-[10px] text-ks-muted">{event.type}</div></td><td className="px-3 py-2 font-mono text-[10px]">{event.appId ?? "boot"}</td><td className="px-3 py-2">{event.channel}</td><td className="px-3 py-2">{event.pluginId ?? event.kitId ?? "—"}<div className="font-mono text-[9px] text-ks-muted">{[...(event.memoryIds ?? []), ...(event.instructionVersions ?? [])].join(" · ") || "no refs"}</div></td><td className="px-3 py-2 font-mono">{(event.requestTokens ?? 0) + (event.responseTokens ?? 0) || "—"}</td><td className="px-3 py-2"><span className={`ks-chip !text-[9px] ${event.outcome === "error" ? "!text-red-700" : ""}`}>{event.outcome}</span></td></tr>)}</tbody></table></div>}{aggregate && <p className="mt-3 text-right font-mono text-[10px] text-ks-muted">all events: {aggregate.totalEvents} · ${aggregate.totalEstimatedCostUsd.toFixed(4)} estimated</p>}</section>;
}

function TraceView({ events, sessions, selectedSession, setSelectedSession }: { events: Event[]; sessions: string[]; selectedSession: string; setSelectedSession: (id: string) => void }) {
  const trace = events.filter((event) => event.sessionId === selectedSession);
  return <section><div className="mb-5 flex flex-wrap items-end gap-3"><label className="text-[10px] text-ks-muted">Session<select className="ks-input mt-1 min-w-[280px] !py-2" value={selectedSession} onChange={(event) => setSelectedSession(event.target.value)}><option value="">Select a session</option>{sessions.map((session) => <option key={session}>{session}</option>)}</select></label>{selectedSession && <span className="font-mono text-[10px] text-ks-muted">{trace.length} events · parentId / traceId retained</span>}</div>{!selectedSession || trace.length === 0 ? <Empty title="No session selected" detail="A session trace appears after the voice flow runs." /> : <div className="ks-card p-4">{trace.map((event, index) => <div key={event.id} className="relative flex gap-3 pb-5 last:pb-0"><div className="flex w-4 shrink-0 justify-center"><div className="z-10 mt-1.5 h-2.5 w-2.5 rounded-full bg-ks-accent" />{index < trace.length - 1 && <div className="absolute bottom-0 top-4 w-px bg-ks-hair" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2"><span className="font-sans text-[13px] font-semibold">{event.operation}</span><span className="ks-chip !text-[9px]">{event.type}</span><span className="font-mono text-[10px] text-ks-muted">{new Date(event.timestamp).toLocaleTimeString()}</span></div><div className="mt-1 grid gap-1 font-mono text-[10px] text-ks-muted sm:grid-cols-3"><span>trace: {event.traceId ?? "—"}</span><span>parent: {event.parentId ?? "root"}</span><span>{event.channel} · {event.outcome}</span></div><div className="mt-1 text-[10px] text-ks-muted">refs: {[...(event.memoryIds ?? []), ...(event.instructionVersions ?? [])].join(" · ") || "none"}</div></div></div>)}</div>}</section>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="ks-card p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-ks-muted">{label}</div><div className="mt-1 font-serif text-[25px]">{value}</div></div>; }
function Loading() { return <div className="flex items-center justify-center py-24"><div className="h-6 w-6 animate-spin rounded-full border-2 border-ks-hair border-t-ks-accent" /></div>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="ks-card p-10 text-center"><h2 className="font-serif text-[24px]">{title}</h2><p className="mt-1 text-[12px] text-ks-muted">{detail}</p></div>; }
