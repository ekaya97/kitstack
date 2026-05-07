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
          region: "eu-central-1",
        },
      },
    };
  },
  async run() {
    const tursoCLI = new sst.x.DevCommand("TursoLocalCLI", {
      dev: {
        autostart: true,
        command: "npm run dev:db",
      },
    });
    await import("./infra/secrets");
    await import("./infra/storage");
    await import("./infra/mcp");
    await import("./infra/web");
    return {};
  },
});
