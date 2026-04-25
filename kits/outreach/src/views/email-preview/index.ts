import { defineView } from "../../sdk";
import { loader } from "./loader";
import { EmailPreviewView } from "./View";

export default defineView({
  slug: "email-preview",
  name: "Email Preview",
  description: "to preview email content with merge field highlighting",
  loader,
  component: EmailPreviewView,
  height: 500,
});
