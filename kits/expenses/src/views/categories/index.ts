import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { CategoriesView } from "./View";

export default defineView({
  slug: "categories",
  name: "Category Breakdown",
  description: "to see expense breakdown by category with percentages and amounts",
  loader,
  component: CategoriesView,
  height: 550,
  placeholder: [
    { category: "software", total: 89900, count: 4 },
    { category: "meals_business", total: 47500, count: 6 },
    { category: "travel", total: 42000, count: 2 },
    { category: "office_supplies", total: 38500, count: 3 },
    { category: "phone_internet", total: 35950, count: 2 },
    { category: "transport", total: 33600, count: 5 },
  ],
});
