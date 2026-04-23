import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Resource } from "sst";

const s3 = new S3Client({});

export async function getDownloadUrl(
  s3Key: string,
  expiresInSeconds = 3600
): Promise<string> {
  if (!s3Key) {
    throw new Error("s3Key is required");
  }

  const command = new GetObjectCommand({
    Bucket: (Resource as any).Assets.name,
    Key: s3Key,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}
