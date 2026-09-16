import { createRestOpenApiConnector, type Connector, type RestOpenApiClient } from "@kitstackco/sdk";

/** Kit-local configuration for an external storefront API binding. */
export interface FressnapfStorefrontConfig {
  baseUrl: string;
  apiKeyHeader?: string;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

/**
 * REST/OpenAPI fixture used by this kit. Host code only binds this instance;
 * tools receive the resulting client through KitContext.connectors.
 */
export const fressnapfStorefrontConnector: Connector<
  FressnapfStorefrontConfig,
  RestOpenApiClient
> = createRestOpenApiConnector({
  id: "rest-openapi.fressnapf-storefront",
  version: "0.1.0",
  capabilities: ["rest.request", "openapi.operation", "catalog.read"],
  requiredScopes: ["storefront.catalog.read"],
});
