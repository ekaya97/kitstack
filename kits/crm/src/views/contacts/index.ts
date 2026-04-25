import { defineView } from "../../sdk";
import { loader } from "./loader";
import { ContactsView } from "./View";

export default defineView({
  slug: "contacts",
  name: "Contacts",
  description: "after adding or updating contacts",
  loader,
  component: ContactsView,
  height: 500,
  permissions: { clipboardWrite: true },
});
