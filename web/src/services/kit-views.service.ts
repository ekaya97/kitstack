import { eq, isNotNull, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { kitViewsTable } from "@/db/schema";
import { Resource } from "sst";

/**
 * Fetch kit views that have preview HTML uploaded to S3.
 * Returns view name + full CDN URL for each preview.
 */
export async function getKitPreviewViews(
  kitId: string
): Promise<{ name: string; previewUrl: string }[]> {
  const rows = await db
    .select({
      viewName: kitViewsTable.viewName,
      previewS3Key: kitViewsTable.previewS3Key,
    })
    .from(kitViewsTable)
    .where(
      and(
        eq(kitViewsTable.kitId, kitId),
        isNotNull(kitViewsTable.previewS3Key)
      )
    );

  const cdnUrl = (Resource as any).KitCdn.url as string;

  return rows
    .filter((r) => r.previewS3Key)
    .map((r) => ({
      name: r.viewName,
      previewUrl: `${cdnUrl}/${r.previewS3Key}`,
    }));
}
