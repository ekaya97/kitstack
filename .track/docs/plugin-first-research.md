# KitStack Plugin-First Research

**Date:** 17 September 2026  
**Purpose:** establish the plugin shape before implementing more reusable
capabilities.

## Decision

KitStack should standardize reusable capability contracts and bindings. It
should not become an agent orchestration framework.

The model is:

```text
capability contract  <- stable interface consumed by a kit
plugin implementation <- provider-specific implementation
binding               <- org/kit/environment configuration and secret refs
```

A kit declares the capabilities it needs. KitStack resolves approved,
version-compatible implementations, binds them with scoped configuration and
secrets, injects capability handles into the kit, and records the invocation.

## Current repo findings

The repo already has useful foundations:

- SDK-level `Plugin`, `PluginManifest`, and `PluginRegistry`;
- connector bindings with separate configuration and secret references;
- host-owned telemetry, audit, identity, and request context;
- debrief plugins for persistence, memory, instructions, AI, HTTP, triggers,
  voice, proxy, and scheduler;
- platform registry and observability Views.

The main structural risk is that there are two plugin models:

1. SDK `Plugin` / `PluginRegistry`;
2. debrief `DemoPlugin` / `PluginRegistry`.

The debrief registry adapts into the SDK registry, but its manifests currently
do not describe real dependencies. Examples include memory depending on
persistence, scheduler depending on persistence, proxy depending on AI, and
the kit depending on memory/instructions/scheduler.

The current arbitrary `lookupPlugin(id)` also permits hidden plugin coupling.

Relevant implementation points:

- `packages/sdk/src/plugins/types.ts`
- `packages/sdk/src/plugins/registry.ts`
- `packages/sdk/src/connectors/index.ts`
- `kits/debrief/src/plugins/registry/index.ts`
- `kits/debrief/src/composition/app/index.ts`

## Recommended contract shape

Use explicit, typed, versioned manifest fields rather than free-form strings:

```ts
type CapabilityRequirement = {
  contract: "kitstack.memory";
  version: "^1.0";
  optional?: boolean;
};

type PluginManifest = {
  apiVersion: "kitstack.dev/v1alpha1";
  id: "memory.default";
  version: "1.2.0";
  provides: [{ contract: "kitstack.memory"; version: "1.0" }];
  requires: [{ contract: "kitstack.storage"; version: "^1.0" }];
  requiredScopes: ["memory:read", "memory:write"];
};
```

The distinction is important:

- `kitstack.memory` is a reusable contract;
- `memory.default` is one implementation;
- a binding selects the implementation and supplies scoped configuration.

## Required behavior

The canonical registry should:

1. validate manifests;
2. resolve capability requirements;
3. check version compatibility;
4. reject missing or ambiguous providers;
5. initialize dependencies in dependency order;
6. expose only resolved capability handles.

Plugins should not discover arbitrary peer plugins by ID. A capability handle
is the dependency boundary.

The minimum lifecycle is:

```text
declared -> validated -> bound -> ready -> degraded/failed -> stopped
```

Registration should be cheap and inspectable. Activation should be lazy unless
a plugin explicitly requires eager startup. Capability calls should be async;
streaming is a separate contract rather than an overload of ordinary invoke.

## Security and operations rules

- Configuration and secrets remain separate.
- Manifests contain secret references, never secret values.
- Resolved secrets are available only while creating a bound capability client.
- Secrets never enter kit context, telemetry, or plugin-to-plugin messages.
- Required scopes are declared by the plugin and enforced by the host.
- Every invocation is wrapped by host-owned metadata telemetry.
- Default telemetry contains identity, kit/app/org, session/trace, plugin and
  capability IDs, operation, latency, outcome, retry count, cost, and error
  type—not request or response bodies.

The internal registry should record implementation ID/version, capability
contract/version, owner, source, maturity, scopes, configuration schema,
secret requirements, supported runtimes, contract-test status, and deprecation
metadata. It is an internal governed catalog, not a marketplace.

## Anti-patterns explicitly rejected

- maintaining two independent plugin registries;
- using implementation IDs as dependency contracts;
- arbitrary plugin lookup from plugin code;
- kits importing libSQL, Twilio, OpenAI, Redis, HubSpot, or AWS clients;
- plugin-owned chains, graphs, planners, memory strategies, or model routers;
- a universal connector matrix before a pilot requires it;
- eager initialization of every registered plugin;
- turning the registry into a workflow engine.

## Execution boundary

### P0: freeze the shape without breaking debrief

- choose one canonical SDK plugin model;
- make manifests describe provided and required capabilities;
- validate manifests and dependency declarations;
- add contract tests for the current memory, persistence, instructions, AI,
  scheduler, and voice implementations;
- preserve the working local debrief flow.

### P1: make reuse real

- add capability requirements to kit composition;
- add scoped provider resolution and version compatibility;
- use the common binding model for connector plugins;
- add registry maturity/ownership metadata;
- demonstrate one capability reused by a second kit.

### Deferred

Remote third-party sandboxing, dynamic installation, marketplace discovery,
universal connector catalogs, agent graphs, chains, planners, and model-routing
abstractions are outside the beta target.

## External reference points

- [Backstage extension points](https://backstage.io/docs/next/backend-system/architecture/extension-points/)
- [OpenFeature provider model](https://openfeature.dev/specification/sections/providers/)
- [VS Code activation events](https://code.visualstudio.com/api/references/activation-events)
- [Semantic Versioning](https://semver.org/)
- [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
