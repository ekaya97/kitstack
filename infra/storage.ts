export const webBucket = new sst.aws.Bucket("WebAssets");
export const userAssetsBucket = new sst.aws.Bucket("UserAssets");
export const skillBucket = new sst.aws.Bucket("SkillAssets");
export const kitBucket = new sst.aws.Bucket("KitAssets", {
  access: "cloudfront",
});

export const kitCdn = new sst.aws.Router("KitCdn", {
  domain: $app.stage != "production" ? undefined : "cdn.kitstack.co",
});

kitCdn.routeBucket("/", kitBucket);
