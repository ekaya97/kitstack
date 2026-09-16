import type {
  AuditSink,
  ChannelContext,
  ConnectorRegistry,
  KitContext,
  Logger,
  RequestIdentity,
  SessionContext,
  StorageBinding,
  StorageAdapter,
  TelemetrySink,
} from "./types";

/**
 * Options used to create a request-scoped kit context.
 *
 * Runtime adapters should call this once at the start of a request and pass
 * the returned object to every capability invoked by that request.
 */
export interface CreateKitContextOptions {
  db: StorageBinding;
  storage?: StorageAdapter;
  params?: Readonly<Record<string, unknown>>;
  connectors?: ConnectorRegistry;
  identity?: RequestIdentity;
  channel?: ChannelContext;
  session?: SessionContext;
  telemetry?: TelemetrySink;
  audit?: AuditSink;
  log?: Logger;
}

const emptyConnectors: ConnectorRegistry = {
  get: () => undefined,
  has: () => false,
  require: (id) => {
    throw new Error(`Connector "${id}" is not registered`);
  },
};

const noopTelemetry: TelemetrySink = {
  event: () => undefined,
  metric: () => undefined,
};

const noopAudit: AuditSink = {
  record: () => undefined,
};

const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/**
 * Construct one immutable SDK-owned context for a single request.
 *
 * The defaults make local development and testing deterministic while still
 * keeping the production contract explicit: hosts supply identity, channel,
 * session, and observability implementations at the boundary.
 */
export function createKitContext(options: CreateKitContextOptions): KitContext {
  const identity = options.identity ?? {
    principal: "dev-user",
    actor: "dev-user",
  };
  const channel = options.channel ?? { kind: "internal" };
  const session = options.session ?? {
    id: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
  };

  return Object.freeze({
    db: options.db,
    ...(options.storage ? { storage: options.storage } : {}),
    params: options.params ?? {},
    connectors: options.connectors ?? emptyConnectors,
    identity,
    channel,
    session,
    telemetry: options.telemetry ?? noopTelemetry,
    audit: options.audit ?? noopAudit,
    log: options.log ?? noopLogger,
  });
}
