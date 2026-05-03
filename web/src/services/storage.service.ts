import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Resource } from "sst";

let _s3: S3Client; function getS3() { if (!_s3) _s3 = new S3Client({}); return _s3; }

export async function getDownloadUrl(
  s3Key: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (!s3Key) {
    throw new Error("s3Key is required");
  }

  const command = new GetObjectCommand({
    Bucket: Resource.SkillAssets.name,
    Key: s3Key,
  });

  return getSignedUrl(getS3(), command, { expiresIn: expiresInSeconds });
}
