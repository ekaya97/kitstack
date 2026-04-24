/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "kitstack",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          profile: process.env.AWS_PROFILE || "enkaprojects",
          region: "eu-central-1"
        }
      }
    };
  },
  async run() {
    await import("./infra/storage");
    const { mcpRouter, appData } = await import("./infra/mcp");
    const { web } = await import("./infra/web");

    return {
      url: web.url,
      mcpUrl: mcpRouter.url,
      appDataUrl: appData.url,
    };
  },
});
