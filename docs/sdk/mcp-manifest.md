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

Use `parseMcpServerManifest` and `resolveMcpPassthrough` from
`@kitstackco/sdk/server`. The returned tool schema remains available for
partial-call discovery. Execution, authentication, grants, and telemetry stay
in the host/router; this module only defines and validates the provider-neutral
mapping contract.
