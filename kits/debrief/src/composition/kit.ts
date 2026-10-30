import { defineLoader, kit as result, type KitContext } from "@kitstackco/sdk";
import { createDebriefKit, type DebriefToolHandler, type DebriefToolName } from "../../kit.config.js";
import prebriefView from "../views/prebrief/index.js";
import confirmationView from "../views/confirmation/index.js";
import customerTimelineView from "../views/customer-timeline/index.js";
import { toPrebriefViewData, type PrebriefLoaderSnapshot } from "../views/prebrief/loader.js";
import { toConfirmationViewData, type ConfirmationLoaderSnapshot } from "../views/confirmation/loader.js";
import { toCustomerTimelineViewData, type CustomerTimelineLoaderSnapshot } from "../views/customer-timeline/loader.js";
import type { DemoApp } from "./app/index.js";
import type { DebriefDraftUpdate } from "../confirmation-contracts.js";
import type { VoiceStatusResult } from "../adapters/voice/index.js";
import { CRM_CONNECTOR_KEY, type CrmClient } from "@kitstackco/crm";
import { crmAccountFor, crmBriefingLines, syncDebriefToCrm } from "./crm.js";
import { VOICE_AGENT_PRINCIPAL } from "../tenancy.js";

const DRAFT_FIELDS = ["outcome", "next_step", "customer_update", "discovered_address", "follow_up_date"] as const;

/**
 * The debrief kit bound to a running host. Every surface (MCP over HTTP or
 * stdio, the platform router, voice agents) calls these tools through
 * KitStack dispatch; there is no second tool table.
 *
 * Each call runs in the caller's organization workspace (see
 * {@link workspaceFor}); handlers are built once per workspace.
 */
export function createBoundDebriefKit(host: DemoApp) {
  const perWorkspace = new WeakMap<DemoApp, Record<DebriefToolName, DebriefToolHandler>>();
  const handlersFor = (workspace: DemoApp) => {
    let handlers = perWorkspace.get(workspace);
    if (!handlers) {
      handlers = createDebriefToolHandlers(workspace);
      perWorkspace.set(workspace, handlers);
    }
    return handlers;
  };
  const toolNames = Object.keys(handlersFor(host)) as DebriefToolName[];
  const handlers = Object.fromEntries(toolNames.map((name): [DebriefToolName, DebriefToolHandler] => [
    name,
    async (ctx, args) => handlersFor(await workspaceFor(host, ctx, args))[name](ctx, args),
  ])) as Record<DebriefToolName, DebriefToolHandler>;
  const base = createDebriefKit(handlers);
  const inWorkspace = (load: (app: DemoApp, ctx: KitContext) => Promise<unknown>) =>
    async (ctx: KitContext) => load(await workspaceFor(host, ctx, ctx.params), ctx);
  return {
    ...base,
    views: [
      bindLoader(prebriefView, inWorkspace(async (app, ctx) => toPrebriefViewData(...await prebriefSnapshot(app, ctx)))),
      bindLoader(confirmationView, inWorkspace(async (app, ctx) => {
        const sessionId = stringParam(ctx, "session_id") ?? app.debrief.getLatestSession()?.sessionId;
        if (!sessionId) throw new Error("No debrief session is available for confirmation");
        const confirmation = await app.debrief.getDebriefForConfirmation(sessionId);
        return toConfirmationViewData(confirmation as unknown as ConfirmationLoaderSnapshot);
      })),
      bindLoader(customerTimelineView, inWorkspace((app, ctx) => customerTimelineData(app, ctx))),
    ],
  };
}

/**
 * The organization workspace a kit call runs in. Authentication binds every
 * MCP principal to its verified organization; the voice agent acts for the
 * session it is bound to. Unbound principals (stdio, loopback without auth)
 * use the host's own workspace; with auth on they are refused.
 */
export async function workspaceFor(host: DemoApp, ctx: KitContext, args?: Readonly<Record<string, unknown>>): Promise<DemoApp> {
  const principal = ctx.identity.principal;
  if (principal === VOICE_AGENT_PRINCIPAL) {
    const sessionId = typeof args?.session_id === "string" ? args.session_id : undefined;
    if (!sessionId) throw new Error("Voice agent kit calls must name their session");
    return host.tenants.forSession(sessionId);
  }
  const orgId = host.tenants.orgForPrincipal(principal);
  if (orgId) return host.tenants.forOrg(orgId);
  if (host.mcpAuthMode !== "none") throw new Error("No organization is bound to this caller");
  return host;
}

/**
 * The signed-in user behind a kit call (the MCP principal, i.e. the router's
 * `sub`), or null for the voice agent. Use it to record a session's owner.
 */
export function requestUserId(ctx: KitContext): string | null {
  const principal = ctx.identity.principal;
  return principal && principal !== VOICE_AGENT_PRINCIPAL ? principal : null;
}

function createDebriefToolHandlers(app: DemoApp): Record<DebriefToolName, DebriefToolHandler> {
  const viaKit = (operation: Record<string, unknown>): DebriefToolHandler => async (ctx) =>
    result.json(await app.plugins.dispatch("kit:debrief", operation, pluginContext(app, ctx, operation.sessionId)));

  const withSession = (
    run: (sessionId: string, args: Record<string, unknown>, ctx: KitContext) => Promise<unknown>,
  ): DebriefToolHandler => async (ctx, args) => {
    const sessionId = String(args.session_id);
    return result.json(await run(sessionId, args, ctx));
  };

  return {
    prepare_debrief: async (ctx, args) => {
      const prepared = await app.plugins.dispatch<Record<string, unknown>, Record<string, unknown>>("kit:debrief", {
      operation: "prepare",
      goal: String(args.goal),
      company: String(args.company),
      contactName: String(args.contact_name),
      location: String(args.location),
      callbackAt: String(args.callback_at),
      callbackTimezone: String(args.callback_timezone),
      bufferMinutes: typeof args.buffer_minutes === "number" ? args.buffer_minutes : 0,
      ...(typeof args.prebrief_call_at === "string" && args.prebrief_call_at.trim() ? { prebriefCallAt: args.prebrief_call_at } : {}),
      ownerId: ctx.identity.principal,
      }, pluginContext(app, ctx));
      const sessionId = typeof prepared.sessionId === "string" ? prepared.sessionId : undefined;
      const account = sessionId ? await crmAccountFor(app, crm(app, ctx), sessionId) : null;
      return result.json({ ...prepared, crm_context: crmBriefingLines(account) });
    },
    prepare_rehearsal: (ctx, args) => viaKit({ operation: "prepare", goal: String(args.goal), ownerId: ctx.identity.principal })(ctx, args),
    get_session: (ctx, args) => viaKit({ operation: "get_session", sessionId: String(args.session_id) })(ctx, args),
    get_debrief: (ctx, args) => viaKit({ operation: "get_debrief", sessionId: String(args.session_id) })(ctx, args),
    get_debrief_draft: withSession(async (sessionId) => ({ fields: (await app.debrief.getDraft(sessionId))?.fields ?? {} })),
    get_debrief_for_confirmation: withSession((sessionId) => app.debrief.getDebriefForConfirmation(sessionId)),
    update_debrief_draft: withSession((sessionId, args) => app.debrief.updateDebriefDraft(sessionId, draftUpdate(args))),
    save_meeting_plan: withSession((sessionId, args) => app.debrief.saveMeetingPlan(sessionId, String(args.plan))),
    confirm_debrief_draft: withSession(async (sessionId, _args, ctx) => {
      const confirmation = await app.debrief.confirmDebriefDraft(sessionId);
      // Confirmation is the act boundary for external writes; a CRM failure
      // is reported but never undoes the confirmed debrief.
      return { ...confirmation, crm: await syncDebriefToCrm(app, crm(app, ctx), sessionId) };
    }),
    get_crm_context: withSession(async (sessionId, _args, ctx) => {
      const client = crm(app, ctx);
      if (!client) return { configured: false };
      return { configured: true, provider: client.provider, account: await crmAccountFor(app, client, sessionId) };
    }),
    sync_debrief_to_crm: withSession((sessionId, _args, ctx) => syncDebriefToCrm(app, crm(app, ctx), sessionId)),
    teach_from_correction: (ctx, args) => viaKit({ operation: "teach", sessionId: String(args.session_id), correction: String(args.correction) })(ctx, args),
    approve_memory: (ctx, args) => viaKit({ operation: "approve", sessionId: String(args.session_id), memoryId: String(args.memory_id) })(ctx, args),
    publish_memory: (ctx, args) => viaKit({ operation: "publish", sessionId: String(args.session_id), memoryId: String(args.memory_id) })(ctx, args),
    start_voice_call: withSession((sessionId, _args, ctx) =>
      app.plugins.dispatch("trigger:voice-http", { operation: "start", sessionId }, pluginContext(app, ctx, sessionId))),
    get_voice_status: withSession(async (sessionId, _args, ctx) => {
      const context = pluginContext(app, ctx, sessionId);
      const current = await app.plugins.dispatch<{ operation: string; sessionId: string }, VoiceStatusResult>("channel:voice", { operation: "status", sessionId }, context);
      // The simulator's first poll completes its scripted turns; later polls are read-only.
      return current.status === "calling"
        ? app.plugins.dispatch<{ operation: string; sessionId: string }, VoiceStatusResult>("channel:voice", { operation: "advance", sessionId }, context)
        : current;
    }),
    confirm_debrief: withSession((sessionId, args, ctx) =>
      app.plugins.dispatch("trigger:voice-http", {
        operation: "complete",
        sessionId,
        outcome: args.outcome === "partial" ? "partial" : "confirmed",
      }, pluginContext(app, ctx, sessionId))),
    register_phone: async (ctx, args) => result.json(await app.plugins.dispatch("kit:debrief", {
      operation: "register_phone", ownerId: ctx.identity.principal, phone: String(args.phone),
    }, pluginContext(app, ctx))),
    verify_phone: async (ctx, args) => result.json(await app.plugins.dispatch("kit:debrief", {
      operation: "verify_phone", ownerId: ctx.identity.principal, phone: String(args.phone), code: String(args.code),
    }, pluginContext(app, ctx))),
    get_phone: async (ctx) => result.json(await app.plugins.dispatch("kit:debrief", {
      operation: "get_phone", ownerId: ctx.identity.principal,
    }, pluginContext(app, ctx))),
    remove_phone: async (ctx) => result.json(await app.plugins.dispatch("kit:debrief", {
      operation: "remove_phone", ownerId: ctx.identity.principal,
    }, pluginContext(app, ctx))),
  };
}

async function prebriefSnapshot(app: DemoApp, ctx: KitContext): Promise<[{ session_id: string; customer_id: string }, PrebriefLoaderSnapshot]> {
  const session = app.debrief.getLatestSession();
  if (!session?.customerId || !session.callbackAt || !session.scheduledCallAt) throw new Error("No prepared customer prebrief is available");
  const customer = await app.debrief.getCustomer(session.customerId);
  if (!customer) throw new Error(`Customer "${session.customerId}" was not found`);
  const history = await app.debrief.recentDebriefSummaries(session.customerId);
  const crmLines = crmBriefingLines(await crmAccountFor(app, crm(app, ctx), session.sessionId));
  const providerStatus = session.state === "failed" ? "unavailable" : session.state === "confirmed" ? "completed" : session.state === "calling" ? "calling" : "scheduled";
  return [
    { session_id: session.sessionId, customer_id: customer.customerId },
    {
      session_id: session.sessionId,
      customer_id: customer.customerId,
      company: customer.company,
      contact_name: customer.contactName,
      location: customer.location,
      prebrief_sections: {
        known: [`Company: ${customer.company}`, `Contact: ${customer.contactName}`, `Location: ${customer.location}`, ...crmLines],
        last_interaction: history[0] ?? "No prior interaction recorded.",
        relevant_history: history.slice(1),
        open_items: ["No open items recorded."],
        call_objective: session.goal,
      },
      prebrief_ends_at: session.callbackAt,
      scheduled_call_at: session.scheduledCallAt,
      destination_masked: "configured demo destination",
      provider_status: providerStatus,
      provider_name: "Twilio + OpenAI Realtime",
    },
  ];
}

async function customerTimelineData(app: DemoApp, ctx: KitContext) {
  const requestedSessionId = stringParam(ctx, "session_id");
  const requestedCustomerId = stringParam(ctx, "customer_id");
  const session = requestedSessionId ? app.debrief.getSession(requestedSessionId) : app.debrief.getLatestSession();
  if (!session) throw new Error("No active debrief session is available for the customer timeline");
  if (!session.customerId) throw new Error(`Debrief session "${session.sessionId}" has no customer for the timeline`);
  if (requestedCustomerId && requestedCustomerId !== session.customerId) {
    throw new Error("Customer timeline customer does not match the requested session");
  }
  const customer = await app.debrief.getCustomer(session.customerId);
  if (!customer) throw new Error(`Customer "${session.customerId}" was not found`);
  const [events, sessionTelemetry, customerTelemetry] = await Promise.all([
    app.debrief.listCustomerEvents(session.customerId),
    app.telemetry.query({ orgId: app.orgId, sessionId: session.sessionId }),
    app.telemetry.query({ orgId: app.orgId, customerId: session.customerId }),
  ]);
  const metadataEvents = [...new Map([...sessionTelemetry, ...customerTelemetry].map((event) => [event.id, event])).values()];
  const snapshot: CustomerTimelineLoaderSnapshot = {
    session_id: session.sessionId,
    customer_id: customer.customerId,
    company: customer.company,
    contact_name: customer.contactName,
    location: customer.location,
    events: events.map((event) => ({
      event_id: event.eventId,
      customer_id: event.customerId,
      session_id: event.sessionId,
      type: event.type,
      occurred_at: event.occurredAt,
      payload: event.payload,
    })),
    provider_metadata: {
      providers: metadataEvents.map((event) => event.provider),
      models: metadataEvents.map((event) => event.model),
      estimated_cost_usd: metadataEvents.reduce((total, event) => total + (event.estimatedCostUsd ?? 0), 0),
      latency_ms: metadataEvents.reduce((total, event) => total + (event.latencyMs ?? 0), 0),
    },
  };
  return toCustomerTimelineViewData({ session_id: session.sessionId, customer_id: customer.customerId }, snapshot);
}

function bindLoader<TView extends { loader?: unknown; loaders?: unknown }>(view: TView, load: (ctx: KitContext) => Promise<unknown>): TView {
  const loader = defineLoader(load);
  return { ...view, loader, loaders: [loader] };
}

/**
 * The CRM bound for this request, if any (kits never see the provider). The
 * host's CRM belongs to the operator, so other organizations never reach it.
 */
function crm(app: DemoApp, ctx: KitContext): CrmClient | undefined {
  if (app.orgId !== app.tenants.operatorOrgId) return undefined;
  return ctx.connectors.get<CrmClient>(CRM_CONNECTOR_KEY);
}

/** Plugin-registry context so host telemetry spans keep the dispatch session. */
function pluginContext(app: DemoApp, ctx: KitContext, sessionId?: unknown) {
  const stableSessionId = typeof sessionId === "string" && sessionId ? sessionId : ctx.session.id;
  return {
    orgId: app.orgId,
    appId: app.appId,
    sessionId: stableSessionId,
    traceId: ctx.session.traceId ?? stableSessionId,
    parentId: ctx.session.parentId ?? null,
    telemetry: app.telemetry,
  };
}

function draftUpdate(args: Record<string, unknown>): DebriefDraftUpdate {
  return Object.fromEntries(DRAFT_FIELDS.flatMap((field) => typeof args[field] === "string" ? [[field, args[field]]] : [])) as DebriefDraftUpdate;
}

function stringParam(ctx: KitContext, name: string): string | undefined {
  const value = ctx.params?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

