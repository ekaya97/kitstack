/**
 * Customer-managed encryption key for Lambda environment variables.
 *
 * Lambda otherwise falls back to its account/region-managed key. Explicitly
 * owning the key keeps function creation independent from that implicit key's
 * state and gives the stack a stable encryption boundary for linked secrets.
 */
export const lambdaEnvironmentKey = new aws.kms.Key("LambdaEnvironmentKey", {
  description: "KitStack Lambda environment variable encryption",
  enableKeyRotation: true,
  policy: aws.getCallerIdentityOutput({}).accountId.apply((accountId) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "EnableAccountIamPermissions",
          Effect: "Allow",
          Principal: {
            AWS: `arn:aws:iam::${accountId}:root`,
          },
          Action: "kms:*",
          Resource: "*",
        },
      ],
    }),
  ),
});
