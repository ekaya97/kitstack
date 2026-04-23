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
    await import("./infra/mcp");

    return {
      url: web.url,
    };
  },
});
