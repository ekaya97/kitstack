/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "kitstack",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        // Prefer explicitly exported short-lived credentials (for example
        // from `aws configure export-credentials`) over a profile. Pulumi's
        // profile option otherwise refreshes an expired SSO cache even when
        // valid AWS_ACCESS_KEY_ID/AWS_SESSION_TOKEN values are present.
        aws: {
          region: "eu-central-1",
          ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {}
            : { profile: process.env.AWS_PROFILE || "enkaprojects" }),
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
