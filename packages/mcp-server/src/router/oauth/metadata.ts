export function getOAuthMetadata(serverUrl: string) {
  return {
    issuer: serverUrl,
    authorization_endpoint: `${serverUrl}/authorize`,
    token_endpoint: `${serverUrl}/token`,
    registration_endpoint: `${serverUrl}/register`,
    revocation_endpoint: `${serverUrl}/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["mcp"],
  };
}

/** RFC 9728 Protected Resource Metadata for MCP clients. */
export function getProtectedResourceMetadata(
  resourceUrl: string,
  authorizationServerUrl = resourceUrl,
) {
  return {
    resource: resourceUrl.replace(/\/$/, ""),
    authorization_servers: [authorizationServerUrl.replace(/\/$/, "")],
    scopes_supported: ["mcp"],
    bearer_methods_supported: ["header"],
  };
}
