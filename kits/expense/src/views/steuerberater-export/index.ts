import { defineView } from "../../sdk";
import { loader } from "./loader";
import { SteuerberaterExportView } from "./View";

export default defineView({
  slug: "steuerberater-export",
  name: "Steuerberater Export",
  description: "to export expenses for the tax advisor with date range filtering and CSV download",
  loader,
  component: SteuerberaterExportView,
  height: 500,
  permissions: { clipboardWrite: true },
});
