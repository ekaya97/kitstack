import crypto from "node:crypto";
import type { LemonSqueezyWebhookEvent } from "./payment.service.types";

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(rawBody).digest("hex");

  if (signature.length !== digest.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export function parseWebhookEvent(body: unknown): LemonSqueezyWebhookEvent {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid webhook payload: body must be an object");
  }

  const obj = body as Record<string, unknown>;

  if (!obj.meta || typeof obj.meta !== "object") {
    throw new Error("Invalid webhook payload: missing meta");
  }

  if (!obj.data || typeof obj.data !== "object") {
    throw new Error("Invalid webhook payload: missing data");
  }

  const data = obj.data as Record<string, unknown>;
  if (!data.attributes || typeof data.attributes !== "object") {
    throw new Error("Invalid webhook payload: missing data.attributes");
  }

  return body as LemonSqueezyWebhookEvent;
}

export async function createCheckoutUrl(
  storeId: string,
  variantId: string,
  email?: string
): Promise<string> {
  const { createCheckout, lemonSqueezySetup } = await import(
    "@lemonsqueezy/lemonsqueezy.js"
  );

  lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY! });

  const checkout = await createCheckout(storeId, variantId, {
    checkoutData: {
      email: email || undefined,
    },
  });

  const url = checkout.data?.data.attributes.url;
  if (!url) {
    throw new Error("Failed to create checkout URL");
  }

  return url;
}
