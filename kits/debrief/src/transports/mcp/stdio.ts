import { pathToFileURL } from "node:url";
import { createDemoApp, type DemoApp } from "../../composition/app/index.js";
import { createConnectorRegistry } from "@kitstackco/sdk";
import { CRM_CONNECTOR_KEY } from "@kitstackco/crm";
import { createDebriefKitServer } from "../../composition/host.js";
import { bindDebriefCrm } from "../../composition/crm.js";

export interface DemoMcpRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface DemoMcpResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface DemoMcpStdioOptions {
  app?: DemoApp;
  appOptions?: Parameters<typeof createDemoApp>[0];
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export interface DemoMcpStdio {
  readonly app: DemoApp;
  handleRequest(request: DemoMcpRequest): Promise<DemoMcpResponse | null>;
  /** Serve until the input ends and every request has been answered. */
  run(): Promise<void>;
}

/** The debrief kit over MCP stdio, on the KitStack server and dispatch path. */
export async function createDemoMcpStdio(options: DemoMcpStdioOptions = {}): Promise<DemoMcpStdio> {
  const app = options.app ?? await createDemoApp(options.appOptions);
  const server = createDebriefKitServer(app, {
    transport: "stdio",
    connectors: createConnectorRegistry({ [CRM_CONNECTOR_KEY]: await bindDebriefCrm(app) }),
    ...(options.input && options.output ? { stdio: { input: options.input, output: options.output } } : {}),
  });
  return {
    app,
    handleRequest: async (request) => await server.protocol.handleRequest(request as never, "default-user") as DemoMcpResponse | null,
    async run() {
      const handle = await server.listen();
      await handle.finished;
    },
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const stdio = await createDemoMcpStdio();
  await stdio.run();
}
