/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "kitstack",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    await import("./infra/storage");
    const { web } = await import("./infra/web");
    const { mcpRouter, appData } = await import("./infra/mcp");

    return {
      url: web.url,
      mcpUrl: mcpRouter.url,
      appDataUrl: appData.url,
    };
  },
});
