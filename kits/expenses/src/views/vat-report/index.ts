import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { VatReportView } from "./View";

export default defineView({
  slug: "vat-report",
  name: "VAT Report",
  description: "to see quarterly VAT summary for UStVA filing — USt collected, Vorsteuer, and Zahllast",
  loader,
  component: VatReportView,
  height: 500,
  placeholder: {
    isKleinunternehmer: false,
    quarterLabel: "Q2 2026",
    revenue: 2850000,
    ustCollected: 454622,
    vorsteuer: [
      { vatRate: 19, totalVat: 89200, totalNet: 380800, totalGross: 470000, count: 15 },
      { vatRate: 7, totalVat: 4200, totalNet: 55800, totalGross: 60000, count: 4 },
    ],
    totalVorsteuer: 93400,
    zahllast: 361222,
  },
});
