import { defineView } from "../../sdk";
import { loader } from "./loader";
import { ProspectListView } from "./View";

export default defineView({
  slug: "prospect-list",
  name: "Prospect List",
  description: "to see all prospects across sequences with search and filtering",
  loader,
  component: ProspectListView,
  height: 500,
});
