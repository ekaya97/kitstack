import { defineView } from "../../sdk";
import { loader } from "./loader";
import { SequenceBuilderView } from "./View";

export default defineView({
  slug: "sequence-builder",
  name: "Sequence Builder",
  description: "to view and manage outreach sequences with their email steps",
  loader,
  component: SequenceBuilderView,
  height: 600,
});
