export const bucket = new sst.aws.Bucket("Assets");
export const kitBucket = new sst.aws.Bucket("KitAssets", {
  access: "cloudfront",
});

export const kitCdn = new sst.aws.Router("KitCdn", {
  domain: $dev ? undefined : "cdn.kitstack.co",
});

kitCdn.routeBucket("/", kitBucket);
