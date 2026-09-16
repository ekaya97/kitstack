import { defineLoader, defineView } from "@kitstackco/sdk";
import { listPlatformGrants } from "../../tools/platform-tools.js";
import { orgIdFromParams } from "../../plugins/platform-data.js";
import { GrantsView } from "./View.js";

export const loader = defineLoader(async (ctx) => listPlatformGrants.load(ctx, { orgId: orgIdFromParams(ctx) }));

export default defineView({
  slug: "grants",
  name: "Platform grants",
  description: "for platform operators to inspect organization grants and effective access",
  loader,
  component: GrantsView,
  height: 620,
  placeholder: [{ subjectType: "user", subjectId: "demo-user", relation: "kit:telemetry", objectType: "organization", objectId: "org-demo" }],
});
