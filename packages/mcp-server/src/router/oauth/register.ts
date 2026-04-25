import { generateClientId, generateClientSecret } from "./helpers";
import type { OAuthStoreItem } from "../types";

interface RegisterRequest {
  client_name?: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
}

interface RegisterResponse {
  client_id: string;
  client_secret: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
}

export async function handleRegister(
  body: RegisterRequest,
  putOAuthItem: (item: OAuthStoreItem) => Promise<void>
): Promise<RegisterResponse> {
  if (!body.redirect_uris || body.redirect_uris.length === 0) {
    throw new Error("redirect_uris is required");
  }

  const clientId = generateClientId();
  const clientSecret = generateClientSecret();

  const registration: RegisterResponse = {
    client_id: clientId,
    client_secret: clientSecret,
    client_name: body.client_name || "MCP Client",
    redirect_uris: body.redirect_uris,
    grant_types: body.grant_types || ["authorization_code", "refresh_token"],
    response_types: body.response_types || ["code"],
    token_endpoint_auth_method: body.token_endpoint_auth_method || "client_secret_post",
  };

  // Store client registration in DynamoDB (30 day TTL)
  await putOAuthItem({
    pk: `CLIENT#${clientId}`,
    sk: "REGISTRATION",
    data: JSON.stringify(registration),
    ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  });

  return registration;
}
