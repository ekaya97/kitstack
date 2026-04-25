import { defineView } from "../../sdk";
import { loader } from "./loader";
import { DashboardView } from "./View";

export default defineView({
  slug: "dashboard",
  name: "Dashboard",
  description: "for CRM metrics and activity overview",
  loader,
  component: DashboardView,
  height: 700,
});
