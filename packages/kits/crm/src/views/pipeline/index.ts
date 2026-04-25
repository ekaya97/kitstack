import { defineView } from "../../sdk";
import { loader } from "./loader";

export default defineView({
  slug: "pipeline",
  name: "Pipeline",
  description: "to see deal pipeline and stages",
  loader,
  component: "./View.tsx",
});
