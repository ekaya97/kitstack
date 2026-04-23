// --- DynamoDB Tables ---

export const kitRegistry = new sst.aws.Dynamo("KitRegistry", {
  fields: { kitId: "string", toolName: "string" },
  primaryIndex: { hashKey: "kitId", rangeKey: "toolName" },
});

export const userKitDbs = new sst.aws.Dynamo("UserKitDbs", {
  fields: { userId: "string", kitId: "string" },
  primaryIndex: { hashKey: "userId", rangeKey: "kitId" },
});

export const oauthStore = new sst.aws.Dynamo("OAuthStore", {
  fields: { pk: "string", sk: "string" },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  ttl: "ttl",
});
