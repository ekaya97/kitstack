# Sales Debrief Kit

`@kitstackco/debrief-kit` is the extraction boundary for KitStack's sales
voice agent. The kit owns sales behavior, tool schemas, agent policy, memory
selection, instructions, and transport-neutral channel/trigger contracts.

The host owns concrete providers. Persistence, AI, telemetry, HTTP, Twilio,
and authentication are supplied as plugins or adapters by the host. The kit
does not import `packages/demo` and does not require a particular database,
voice provider, or HTTP framework.

## Public surface

- `kit.config.ts` preserves the existing `debrief` kit identity and MCP tool
  contract.
- `src/index.ts` is the package entrypoint.
- `createSalesAgent()` creates the bounded `defineAgent` loop.
- `createDebriefTools()` creates the transport-neutral SDK tools.
- `createDebriefToolHandlers()` adapts a host service backed by plugins.
- `createMemoryPolicy()`, `createVoiceChannel()`, and the trigger factories
  define kit-facing policy boundaries.

## Host integration

The host resolves plugins, builds the concrete service that implements the
kit's operation port, and binds that service to the kit. A minimal composition
looks like this:

```ts
import {
  asAgentInstructions,
  createDebriefKit,
  createDebriefToolHandlers,
  createSalesAgent,
  type DebriefCapabilities,
  type DebriefOperations,
} from "@kitstackco/debrief-kit";

const capabilities: DebriefCapabilities = {
  persistence: persistencePlugin, // libSQL, DynamoDB, or another host plugin
  memory: memoryPlugin,           // policy backed by persistencePlugin
  instructions: instructionsPlugin,
  telemetry: telemetryPlugin,
  ai: aiPlugin,
};

// The host service composes persistence, memory, instructions, telemetry,
// and AI. It is deliberately not part of the kit package.
const operations: DebriefOperations = createSalesOperations(capabilities);
const kit = createDebriefKit(createDebriefToolHandlers(operations));

const agent = createSalesAgent({
  capabilities,
  instructions: asAgentInstructions({ context: "voice" }),
  turnSource: voiceChannel.turnSource,
  model: realtimeModelAdapter,
  output: voiceChannel.output,
  tools: voiceChannel.tools,
  hooks: telemetryHooks,
});
```

The same kit can be mounted behind MCP/chat, an HTTP trigger, a manual demo
trigger, or a Twilio voice trigger. Each trigger normalizes its input into the
same kit operation; the business policy does not move into the transport.

## Development

```bash
npm run typecheck
npm test
```

This slice intentionally does not move the existing demo implementations. It
defines the stable package boundary so those implementations can be migrated
and wired as plugins in the next extraction slice.
