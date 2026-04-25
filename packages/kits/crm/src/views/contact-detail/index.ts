import { defineView } from "../../sdk";
import { loader } from "./loader";

export default defineView({
  slug: "contact-detail",
  name: "Contact Detail",
  description: "to view detailed contact info with deals and activity",
  loader,
  component: "./View.tsx",
});
