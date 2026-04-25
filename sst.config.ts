/// <reference path="./.sst/platform/config.d.ts" />

import { DevCommand } from "./.sst/platform/src/components/experimental";

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
    await import("./infra/secrets");
    await import("./infra/storage");
    const { mcpRouter, appData, kitLambdaRole, kitRuntimeLayer } = await import("./infra/mcp");
    const { web } = await import("./infra/web");

    const tursoCLI = new sst.x.DevCommand("TursoLocalCLI", {
      dev: {
        autostart: true,
        command: "npm run dev:db"
      }
    })
    return {
      url: web.url,
      mcpUrl: mcpRouter.url,
      appDataUrl: appData.url,
      kitLambdaRoleArn: kitLambdaRole.arn,
      kitRuntimeLayerArn: kitRuntimeLayer.arn,
    };
  },
});
