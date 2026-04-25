import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature, parseWebhookEvent } from "../payment.service";

describe("verifyWebhookSignature", () => {
  const secret = "test-webhook-secret";

  function sign(body: string): string {
    return crypto.createHmac("sha256", secret).update(body).digest("hex");
  }

  it("returns true for a valid signature", () => {
    const body = '{"data": "test"}';
    const signature = sign(body);
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    const body = '{"data": "test"}';
    expect(verifyWebhookSignature(body, "invalid-signature", secret)).toBe(false);
  });

  it("returns false for a tampered body", () => {
    const body = '{"data": "test"}';
    const signature = sign(body);
    expect(verifyWebhookSignature('{"data": "tampered"}', signature, secret)).toBe(false);
  });

  it("returns false for wrong secret", () => {
    const body = '{"data": "test"}';
    const signature = sign(body);
    expect(verifyWebhookSignature(body, signature, "wrong-secret")).toBe(false);
  });
});

describe("parseWebhookEvent", () => {
  const validEvent = {
    meta: {
      event_name: "order_created",
    },
    data: {
      id: "123",
      attributes: {
        status: "paid",
        total: 1299,
        currency: "EUR",
        user_email: "buyer@example.com",
        first_order_item: {
          product_id: 456,
          variant_id: 789,
        },
      },
    },
  };

  it("parses a valid order_created event", () => {
    const result = parseWebhookEvent(validEvent);
    expect(result.meta.event_name).toBe("order_created");
    expect(result.data.attributes.user_email).toBe("buyer@example.com");
    expect(result.data.attributes.total).toBe(1299);
  });

  it("throws on null input", () => {
    expect(() => parseWebhookEvent(null)).toThrow();
  });

  it("throws on missing meta", () => {
    expect(() => parseWebhookEvent({ data: validEvent.data })).toThrow();
  });

  it("throws on missing data", () => {
    expect(() => parseWebhookEvent({ meta: validEvent.meta })).toThrow();
  });

  it("throws on missing data.attributes", () => {
    expect(() =>
      parseWebhookEvent({ meta: validEvent.meta, data: { id: "123" } })
    ).toThrow();
  });
});
