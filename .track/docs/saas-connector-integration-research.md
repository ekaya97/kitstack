# SaaS Connector Integration Research

**Date:** 26 September 2026  
**Decision status:** research input for beta sequencing; no external service is on the local-demo critical path

## Recommendation

Keep KitStack's `Connector<Config, Client>`, `ConnectorBinding`, and
`SecretReference` contracts as the only kit-facing API. Use an external service
behind an adapter only when a pilot needs a provider that is not worth owning.

- **First pilot candidate: Nango.** It is the closest fit for an SDK-owned
  connector boundary: OAuth/token lifecycle, proxying, webhooks, incremental
  syncs, custom TypeScript functions, self-host/BYOC options, and a broad API
  catalog.
- **Long-tail candidate: Pipedream Connect.** It offers broad managed app and
  action coverage and can supply a provider quickly, but its managed boundary
  and less-transparent self-hosting/data-residency posture make adapter
  isolation essential.
- **Sync-heavy workloads: Airbyte.** Use it for replication, indexing, and
  background memory enrichment, not for low-latency agent actions.
- **Normalized categories: Merge.dev.** Use only when a stable cross-provider
  object model (for example HRIS or ATS) is the actual requirement.
- **Agent-native action catalog: Composio, later and cautiously.** It is useful
  for authenticated tools and triggers, but it is close to an agent runtime;
  deep adoption would conflict with KitStack's thin-wrapper boundary.

Zapier, Workato, and Tray remain optional customer-side automation targets, not
the foundation of KitStack's connector registry.

## Comparison

| Option | Best fit | Strengths | Main concern | KitStack posture |
|---|---|---|---|---|
| Nango | First connector pilot | OAuth, refresh tokens, proxy, webhooks, syncs, TypeScript, self-host/BYOC | Runtime/licensing dependency | Preferred adapter-backed pilot |
| Pipedream Connect | Long tail | Very broad app/action catalog, managed auth and triggers | Managed-service and residency constraints | Optional fallback adapter |
| Composio | Agent actions | Toolkits, auth, triggers, sessions, MCP, TypeScript | Pulls toward an agent execution model | Evaluate only for a narrow action use case |
| Merge.dev | Normalized business category | Linked accounts, normalized APIs, syncs, webhooks | Closed/category-specific and costly | Use only when normalization pays for itself |
| Airbyte | Bulk data movement | Open-source connectors, self-management, Connector Builder, OAuth | Sync-oriented, not request/response action-oriented | Separate sync adapter, not default connector |

## Required adapter boundary

The external platform must be invisible to kit code. The adapter should map
the provider to the existing contracts and expose only the capability needed by
the kit:

```ts
Connector<Config, Client>
ConnectorBinding
SecretReference
```

The binding records `orgId`, `appId`, provider, external account ID, opaque
secret reference, scopes, and capabilities. The adapter must:

1. resolve credentials only through the secret reference;
2. keep provider schemas and pagination inside the adapter;
3. normalize errors, retries, rate limits, and webhook/sync cursors;
4. preserve org/app/user/trace identity;
5. emit KitStack audit and metadata-only telemetry;
6. support a deterministic local implementation with the same contract.

The kit must not know whether the implementation is native, Nango-backed,
Pipedream-backed, or a local mock.

## Local-mock-first sequence

Before credentials or SaaS accounts are introduced:

1. define the KitStack-facing capability contract;
2. implement a deterministic local adapter and fixture store;
3. add expired-credential, rate-limit, timeout, malformed-response, and
   provider-unavailable cases;
4. record binding identity, scopes, calls, outputs, audit, and telemetry;
5. run the kit through the normal plugin/dispatch path;
6. add a provider-backed adapter as a conformance implementation;
7. compare provider behavior with the mock contract before enabling it for a
   pilot.

This keeps Entra, Twilio, CRM, calendar, OTLP, and other external accounts
off the critical path while the registry, plugin composition, routing, audit,
and dashboards are made reliable.

## Sources

- [Nango integrations](https://nango.dev/api-integrations),
  [Nango infrastructure](https://docs.nango.dev/guides/infrastructure),
  [Nango pricing](https://nango.dev/pricing)
- [Pipedream app catalog](https://pipedream.com/apps),
  [Pipedream Universal API](https://pipedream.com/apps/universal-api)
- [Composio authentication](https://docs.composio.dev/docs/authentication),
  [Composio token custody](https://docs.composio.dev/docs/security/token-custody)
- [Merge concepts](https://docs.merge.dev/merge-unified/concepts),
  [Merge webhooks](https://docs.merge.dev/merge-unified/reading-data/webhooks/overview)
- [Airbyte integrations](https://docs.airbyte.com/integrations),
  [Airbyte Connector Builder](https://airbyte.com/connector-builder)

## Research output

This document records the bounded research delegated to a subagent. It is a
selection input, not a commitment to install any of these services. The next
decision point is after the local connector contract and mock conformance
gates (T-0227 and T-0229) pass.
