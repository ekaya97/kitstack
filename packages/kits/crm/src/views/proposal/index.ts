import { defineView } from "../../sdk";
import { loader } from "./loader";
import { ProposalView } from "./View";

export default defineView({
  slug: "proposal",
  name: "Proposal",
  description: "to review deal proposals",
  loader,
  component: ProposalView,
  height: 500,
  permissions: { clipboardWrite: true },
});
