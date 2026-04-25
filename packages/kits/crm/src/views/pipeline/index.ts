import { defineView } from "../../sdk";
import { loader } from "./loader";
import { PipelineView } from "./View";

export default defineView({
  slug: "pipeline",
  name: "Pipeline",
  description: "to see deal pipeline and stages",
  loader,
  component: PipelineView,
  height: 600,
});
