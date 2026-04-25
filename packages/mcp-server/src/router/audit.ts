type AuditAction =
  | "tool.call"
  | "tool.call.error"
  | "auth.token.issued"
  | "auth.token.refreshed"
  | "auth.token.revoked"
  | "auth.failed"
  | "appdata.query";

interface AuditEntry {
  action: AuditAction;
  userId?: string;
  kitId?: string;
  toolName?: string;
  detail?: string;
  durationMs?: number;
}

/**
 * Structured audit log emitted as JSON to stdout (CloudWatch).
 * Queryable via CloudWatch Logs Insights:
 *   filter audit = true | filter action = "tool.call"
 */
export function audit(entry: AuditEntry): void {
  const record = {
    audit: true,
    ts: new Date().toISOString(),
    ...entry,
  };
  // Use process.stdout.write to emit a single JSON line (avoids console.log prefixes)
  process.stdout.write(JSON.stringify(record) + "\n");
}
