import type { PluginDescriptor } from "./plugin-observability";

export type RuntimeEvent = {
  id: string;
  timestamp: string;
  sessionId?: string | null;
  customerId?: string | null;
  appId?: string | null;
  kitId?: string | null;
  channel: string;
  outcome: string;
  operation: string;
};

export type RuntimeApp = { id: string; name: string; org: string; scopes: string[]; createdAt: string };
export type RuntimeKit = { id: string; version: string; status: string };
export type RuntimeJob = {
  scheduledCallId: string;
  sessionId: string;
  scheduledAt: string;
  status: string;
  attemptCount: number;
  providerCallId: string | null;
  error: string | null;
};
export type RuntimeSession = {
  sessionId: string;
  customerId: string | null;
  customerName: string | null;
  appId: string | null;
  kitId: string | null;
  state: string;
  scheduledCallAt: string | null;
  callId: string | null;
  lastEventAt: string | null;
  error: string | null;
};
export type RuntimeCustomer = { id: string; company: string; contactName: string };
export type ProviderHealth = {
  provider: string;
  status: "healthy" | "degraded" | "idle";
  eventCount: number;
  errorCount: number;
  lastEventAt: string | null;
  recentFailures: Array<{ timestamp: string; operation: string; sessionId: string | null }>;
};

export function RuntimeRegistryView({
  events,
  plugins,
  apps,
  kits,
  schedulerJobs,
  sessions,
  customers,
  providerHealth,
}: {
  events: RuntimeEvent[];
  plugins: PluginDescriptor[];
  apps: RuntimeApp[];
  kits: RuntimeKit[];
  schedulerJobs: RuntimeJob[];
  sessions: RuntimeSession[];
  customers: RuntimeCustomer[];
  providerHealth: ProviderHealth[];
}) {
  const activeJobs = schedulerJobs.filter((job) => job.status === "scheduled" || job.status === "starting");
  const failedEvents = events.filter((event) => event.outcome === "error");
  return <section aria-label="Runtime and registry">
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Metric label="Kits" value={kits.length} />
      <Metric label="Plugins" value={plugins.length} />
      <Metric label="Active jobs" value={activeJobs.length} />
      <Metric label="Sessions" value={sessions.length} />
      <Metric label="Recent failures" value={failedEvents.length} />
    </div>
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="ks-card overflow-x-auto">
        <div className="border-b border-ks-hair p-5"><h2 className="font-serif text-[24px]">Runtime / Registry</h2><p className="mt-1 text-[12px] text-ks-muted">Registered capabilities and the live metadata links behind this demo run.</p></div>
        <table className="w-full text-left text-[11px]"><caption className="sr-only">Registered kits and plugins</caption><thead className="border-b border-ks-hair bg-ks-paper-warm text-ks-muted"><tr>{["Capability", "Kind", "Version", "Status"].map((heading) => <th key={heading} className="px-3 py-2 font-medium">{heading}</th>)}</tr></thead><tbody>
          {kits.map((kit) => <tr key={`kit-${kit.id}`} className="border-b border-ks-hair/50"><td className="px-3 py-2 font-mono text-[10px]">kit:{kit.id}</td><td className="px-3 py-2">kit</td><td className="px-3 py-2 font-mono text-[10px]">{kit.version}</td><td className="px-3 py-2"><StatusChip value={kit.status} /></td></tr>)}
          {plugins.filter((plugin) => plugin.kind !== "kit").map((plugin) => <tr key={plugin.id} className="border-b border-ks-hair/50"><td className="px-3 py-2 font-mono text-[10px]">{plugin.id}</td><td className="px-3 py-2">{plugin.kind}</td><td className="px-3 py-2 font-mono text-[10px]">{plugin.version}</td><td className="px-3 py-2"><StatusChip value={plugin.status} /></td></tr>)}
        </tbody></table>
      </div>
      <div className="ks-card p-5"><h2 className="font-serif text-[24px]">Provider health</h2><p className="mt-1 text-[12px] text-ks-muted">Provider state is derived from metadata-only telemetry.</p><div className="mt-4 space-y-3">{providerHealth.map((provider) => <div key={provider.provider} className="rounded-lg border border-ks-hair p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[11px]">{provider.provider}</span><StatusChip value={provider.status} /></div><div className="mt-2 text-[11px] text-ks-muted">{provider.eventCount} events · {provider.errorCount} errors · last {formatTime(provider.lastEventAt)}</div>{provider.recentFailures.length > 0 && <div className="mt-2 border-t border-ks-hair pt-2 text-[10px] text-red-700">Recent failure: {provider.recentFailures[0].operation} · {formatTime(provider.recentFailures[0].timestamp)}</div>}</div>)}{providerHealth.length === 0 && <Empty title="No provider activity" detail="Provider health will appear when the runtime reports an event." />}</div></div>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="ks-card p-5"><h2 className="font-serif text-[24px]">Registered apps</h2><div className="mt-4 space-y-2">{apps.length === 0 ? <p className="text-[12px] text-ks-muted">No app registrations yet.</p> : apps.map((app) => <div key={app.id} className="rounded-lg border border-ks-hair p-3"><div className="font-medium">{app.name}</div><div className="mt-1 font-mono text-[10px] text-ks-muted">{app.id} · {app.org}</div></div>)}</div></div>
      <div className="ks-card overflow-x-auto"><div className="border-b border-ks-hair p-5"><h2 className="font-serif text-[24px]">Scheduler and call linkage</h2><p className="mt-1 text-[12px] text-ks-muted">Customer → session → kit → provider state, with no call content.</p></div><table className="w-full text-left text-[11px]"><caption className="sr-only">Scheduler jobs and active sessions</caption><thead className="border-b border-ks-hair bg-ks-paper-warm text-ks-muted"><tr>{["Customer", "Session / kit", "Schedule", "State", "Call"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-2 font-medium">{heading}</th>)}</tr></thead><tbody>{sessions.map((session) => { const job = schedulerJobs.find((candidate) => candidate.sessionId === session.sessionId); return <tr key={session.sessionId} className="border-b border-ks-hair/50"><td className="px-3 py-3">{session.customerName ?? session.customerId ?? "Unassigned"}<div className="font-mono text-[9px] text-ks-muted">{session.customerId ?? "—"}</div></td><td className="px-3 py-3 font-mono text-[10px]">{session.sessionId}<div className="text-[9px] text-ks-muted">{session.kitId ?? "kit not reported"}</div></td><td className="whitespace-nowrap px-3 py-3 font-mono text-[10px]">{formatTime(session.scheduledCallAt ?? job?.scheduledAt ?? null)}</td><td className="px-3 py-3"><StatusChip value={session.state} />{job && <div className="mt-1 text-[9px] text-ks-muted">job {job.status} · attempt {job.attemptCount}</div>}</td><td className="px-3 py-3 font-mono text-[10px]">{session.callId ?? job?.providerCallId ?? "—"}</td></tr>})}</tbody></table>{sessions.length === 0 && <div className="p-8"><Empty title="No runtime sessions" detail="Prepare a customer debrief to create a linked session." /></div>}</div>
    </div>
    <p className="mt-3 text-[10px] text-ks-muted">{customers.length} customer record{customers.length === 1 ? "" : "s"} linked from the current telemetry window. Names are registry metadata only.</p>
  </section>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="ks-card p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-ks-muted">{label}</div><div className="mt-1 font-serif text-[25px]">{value}</div></div>; }
function StatusChip({ value }: { value: string | null | undefined }) { const label = value ?? "not reported"; return <span className={`ks-chip !text-[9px] ${label === "degraded" || label === "failed" ? "!text-red-700" : ""}`}>{label}</span>; }
function formatTime(value: string | null) { return value ? new Date(value).toLocaleString() : "Not reported"; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="ks-card p-6 text-center"><h2 className="font-serif text-[20px]">{title}</h2><p className="mt-1 text-[11px] text-ks-muted">{detail}</p></div>; }
