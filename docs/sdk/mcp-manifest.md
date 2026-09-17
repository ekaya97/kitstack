# MCP server manifests

KitStack can describe a bring-your-own MCP server through the same `kit()`
surface used by SDK-built kits. The server does not import KitStack. It ships a
small data-only manifest declaring the metadata the router cannot infer from a
`tools/list` response: permission class, locked tools, and memory namespaces.

The SDK validates the manifest at registration time and maps a shell command to
the server's native MCP request:

```text
kit("salesforce", "get_customer", {"name": "Acme"})
  -> tools/call {"name":"get_customer","arguments":{"name":"Acme"}}
```

Use `parseMcpServerManifest`, `resolveMcpPassthrough`, and `withMcpServers` from
`@kitstackco/sdk/server`. A self-hosted server can register the host-owned MCP
transport directly:

```ts
serve({
  kit,
  db: { url: "file:.kitstack/dev.db" },
  mcpServers: [{
    manifest,
    call: (request, context) => myMcpClient.call(request, context),
  }],
});
```

The returned tool schema remains available for partial-call discovery.
Authentication, grants, and telemetry stay in the host/router. The cloud
platform adapter accepts the same registration list, so deployments can
resolve manifests from their registry without changing the SDK-built kit path.
Loader requests also preserve request/session/trace correlation through the
adapter boundary.
