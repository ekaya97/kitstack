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
    const { lambdaEnvironmentKey } = await import("./infra/kms");

    // Use an explicit customer-managed key for all Lambda environment
    // variables. SST injects linked resource bindings and its runtime key into
    // every function environment; without this, Lambda relies on an implicit
    // regional key and can fail CreateFunction with an opaque KMS error.
    $transform(sst.aws.Function, (args) => {
      const existing = args.transform?.function;

      args.transform = {
        ...args.transform,
        function: (lambdaArgs, opts, name) => {
          if (typeof existing === "function") {
            existing(lambdaArgs, opts, name);
          } else if (existing) {
            Object.assign(lambdaArgs, existing);
          }

          lambdaArgs.kmsKeyArn ??= lambdaEnvironmentKey.arn;
        },
      };
    });

    const tursoCLI = new sst.x.DevCommand("TursoLocalCLI", {
      dev: {
        autostart: true,
        command: "npm run dev:db",
      },
    });
    await import("./infra/secrets");
    await import("./infra/storage");
    await import("./infra/mcp");
    await import("./infra/demo");
    await import("./infra/web");
    return {};
  },
});
