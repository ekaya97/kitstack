/**
 * Optional registry snapshot returned by a future observability API.
 *
 * The current demo API does not return `plugins`; rows are derived from the
 * existing metadata-only telemetry events when the field is absent.
 */
export type PluginDescriptor = {
  id: string;
  kind?: string | null;
  version?: string | null;
  status?: string | null;
  registeredAt?: string | null;
  invocationCount?: number | null;
  lastInvokedAt?: string | null;
  errorCount?: number | null;
};

export type PluginObservabilityEvent = {
  id: string;
  timestamp: string;
  pluginId?: string | null;
  type: string;
  operation: string;
  outcome: string;
};

export type PluginRow = {
  id: string;
  kind: string;
  version: string;
  status: string;
  registeredAt: string | null;
  invocationCount: number;
  lastInvokedAt: string | null;
  errorCount: number;
};

export function buildPluginRows(
  events: PluginObservabilityEvent[],
  descriptors: PluginDescriptor[] = [],
): PluginRow[] {
  const ids = new Set<string>(descriptors.map((plugin) => plugin.id));
  for (const event of events) {
    if (event.pluginId) ids.add(event.pluginId);
  }

  return [...ids].map((id) => {
    const descriptor = descriptors.find((plugin) => plugin.id === id);
    const pluginEvents = events
      .filter((event) => event.pluginId === id)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const registration = pluginEvents.find((event) => event.type === "plugin.registered");
    const activity = pluginEvents.filter((event) => event.type !== "plugin.registered");
    const lastActivity = [...activity].at(-1);
    const errorCount = activity.filter((event) => event.outcome === "error").length;

    return {
      id,
      kind: descriptor?.kind || "Not reported",
      version: descriptor?.version || "Not reported",
      status: descriptor?.status || (registration ? "Registered" : "Observed"),
      registeredAt: descriptor?.registeredAt || registration?.timestamp || null,
      invocationCount: descriptor?.invocationCount ?? activity.length,
      lastInvokedAt: descriptor?.lastInvokedAt || lastActivity?.timestamp || null,
      errorCount: descriptor?.errorCount ?? errorCount,
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
}

export function PluginObservabilityView({
  events,
  plugins,
}: {
  events: PluginObservabilityEvent[];
  plugins?: PluginDescriptor[];
}) {
  const rows = buildPluginRows(events, plugins);
  const registered = rows.filter((plugin) => plugin.registeredAt).length;
  const invocations = rows.reduce((total, plugin) => total + plugin.invocationCount, 0);

  return <section aria-label="Plugin observability">
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Plugins observed" value={rows.length} />
      <Metric label="Registered" value={registered} />
      <Metric label="Activity events" value={invocations} />
      <Metric label="Errors" value={rows.reduce((total, plugin) => total + plugin.errorCount, 0)} />
    </div>
    {rows.length === 0 ? <div className="ks-card p-10 text-center"><h2 className="font-serif text-[24px]">No plugin activity</h2><p className="mt-1 text-[12px] text-ks-muted">Plugin registration and invocation metadata will appear here when the demo runtime starts.</p></div> : <div className="ks-card overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <caption className="sr-only">Registered and observed KitStack plugins</caption>
        <thead className="border-b border-ks-hair bg-ks-paper-warm text-ks-muted"><tr>{["Plugin", "Kind", "Version", "Status", "Registered", "Invocations", "Last activity"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-2 font-medium">{heading}</th>)}</tr></thead>
        <tbody>{rows.map((plugin) => <tr key={plugin.id} className="border-b border-ks-hair/50">
          <td className="px-3 py-3 font-mono text-[10px]">{plugin.id}</td>
          <td className="px-3 py-3">{plugin.kind}</td>
          <td className="px-3 py-3 font-mono text-[10px]">{plugin.version}</td>
          <td className="px-3 py-3"><span className={`ks-chip !text-[9px] ${plugin.errorCount ? "!text-red-700" : ""}`}>{plugin.status}</span></td>
          <td className="whitespace-nowrap px-3 py-3 font-mono text-[10px]">{formatTimestamp(plugin.registeredAt)}</td>
          <td className="px-3 py-3 font-mono">{plugin.invocationCount}</td>
          <td className="whitespace-nowrap px-3 py-3 font-mono text-[10px]">{formatTimestamp(plugin.lastInvokedAt)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    <p className="mt-3 text-[10px] text-ks-muted">Registration and activity are derived from the existing metadata-only observability events. Kind, version, and status are shown when the API reports them.</p>
  </section>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="ks-card p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-ks-muted">{label}</div><div className="mt-1 font-serif text-[25px]">{value}</div></div>;
}

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not reported";
}
