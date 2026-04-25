import { defineView } from "../../sdk";
import { loader } from "./loader";
import { CategoryDashboardView } from "./View";

export default defineView({
  slug: "category-dashboard",
  name: "Category Dashboard",
  description: "after categorizing expenses or generating quarterly summaries",
  loader,
  component: CategoryDashboardView,
  height: 500,
});
