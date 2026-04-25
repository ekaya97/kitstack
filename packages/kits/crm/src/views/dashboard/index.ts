import { defineView } from "../../sdk";
import { loader } from "./loader";

export default defineView({
  slug: "dashboard",
  name: "Dashboard",
  description: "for CRM metrics and activity overview",
  loader,
  component: "./View.tsx",
});
