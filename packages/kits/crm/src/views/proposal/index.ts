import { defineView } from "../../sdk";
import { loader } from "./loader";

export default defineView({
  slug: "proposal",
  name: "Proposal",
  description: "to review deal proposals",
  loader,
  component: "./View.tsx",
  permissions: { clipboardWrite: true },
});
