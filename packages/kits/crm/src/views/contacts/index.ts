import { defineView } from "../../sdk";
import { loader } from "./loader";

export default defineView({
  slug: "contacts",
  name: "Contacts",
  description: "after adding or updating contacts",
  loader,
  component: "./View.tsx",
  permissions: { clipboardWrite: true },
});
