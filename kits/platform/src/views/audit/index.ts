import { defineLoader, defineView } from "@kitstackco/sdk";
import { getPlatformAuditStatus } from "../../tools/platform-tools.js";
import { orgIdFromParams } from "../../plugins/platform-data.js";
import { AuditStatusView } from "./View.js";

export const loader = defineLoader(async (ctx) => getPlatformAuditStatus.load(ctx, { orgId: orgIdFromParams(ctx) }));

export default defineView({
  slug: "audit",
  name: "Audit status",
  description: "to inspect grant-scoped metadata-only audit evidence and export status",
  loader,
  component: AuditStatusView,
  height: 620,
  placeholder: {
    mode: "metadata-only",
    status: "empty",
    eventCount: 0,
    lastEventAt: null,
    externalExport: "not_reported",
  },
});
