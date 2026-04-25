import { defineView } from "../../sdk";
import { loader } from "./loader";
import { ImportReviewView } from "./View";

export default defineView({
  slug: "import-review",
  name: "Import Review",
  description: "after importing expenses from CSV, to review and confirm entries",
  loader,
  component: ImportReviewView,
  height: 500,
});
