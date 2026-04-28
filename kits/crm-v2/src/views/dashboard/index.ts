import { defineView } from "@kitstack/sdk";
import { loader } from "./loader";
import { DashboardView } from "./View";

export default defineView({
  slug: "dashboard",
  name: "Dashboard",
  description: "for an overview of all items",
  loader,
  component: DashboardView,
  height: 400,
});
