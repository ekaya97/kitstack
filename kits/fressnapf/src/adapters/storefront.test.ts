import { describe, expect, it, vi } from "vitest";
import { bindConnector } from "@kitstackco/sdk";
import { fressnapfStorefrontConnector } from "./storefront";

describe("Fressnapf REST/OpenAPI connector", () => {
  it("uses the shared binding contract without exposing the API key", async () => {
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
      expect(input).toBe("https://storefront.example.test/catalog/products?species=dog");
      expect(init?.headers).toEqual({ Authorization: "Bearer storefront-secret" });
      return new Response(JSON.stringify({ products: [{ id: "dog-food-1" }] }), { status: 200 });
    });
    const client = await bindConnector(
      fressnapfStorefrontConnector,
      {
        connectorId: "rest-openapi.fressnapf-storefront",
        config: { baseUrl: "https://storefront.example.test", fetch: fetcher },
        secretRefs: { apiKey: "org/fressnapf/catalog" },
      },
      { get: vi.fn(async (reference: string) => reference === "org/fressnapf/catalog" ? "storefront-secret" : undefined) },
    );

    const result = await client.request({ path: "/catalog/products", query: { species: "dog" } });
    expect(result).toEqual({ products: [{ id: "dog-food-1" }] });
    expect(JSON.stringify(result)).not.toContain("storefront-secret");
  });
});
