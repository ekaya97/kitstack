import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { PipelineView } from "./View";

export default defineView({
  slug: "pipeline",
  name: "Deal Pipeline",
  description: "to see the deal pipeline with stages, values, and probabilities",
  loader,
  component: PipelineView,
  height: 520,
  placeholder: [
    { id: "deal_abc01", title: "Acme Corp Redesign", stage: "lead", valueCents: 850000, currency: "EUR", probability: 30, expectedClose: "2026-06-15", contactName: "Anna Müller", companyName: "Acme Corp" },
    { id: "deal_abc02", title: "CloudSync Integration", stage: "contacted", valueCents: 320000, currency: "EUR", probability: 50, expectedClose: "2026-07-01", contactName: "Jonas Fischer", companyName: "CloudSync GmbH" },
    { id: "deal_abc03", title: "FinLedger Audit Tool", stage: "proposal", valueCents: 1200000, currency: "EUR", probability: 65, expectedClose: "2026-06-30", contactName: "Lisa Chen", companyName: "FinLedger" },
    { id: "deal_abc04", title: "RetailOS POS Rewrite", stage: "proposal", valueCents: 480000, currency: "EUR", probability: 45, expectedClose: "2026-08-10", contactName: "Marc Bauer", companyName: "RetailOS" },
    { id: "deal_abc05", title: "Müller GmbH Branding", stage: "negotiation", valueCents: 2400000, currency: "EUR", probability: 80, expectedClose: "2026-05-28", contactName: "Sophie Müller", companyName: "Müller GmbH" },
    { id: "deal_abc06", title: "DataVault Migration", stage: "negotiation", valueCents: 560000, currency: "EUR", probability: 75, expectedClose: "2026-06-20", contactName: "Tom Richter", companyName: "DataVault AG" },
    { id: "deal_abc07", title: "GreenTech Dashboard", stage: "won", valueCents: 950000, currency: "EUR", probability: 100, expectedClose: "2026-04-15", contactName: "Eva Schmidt", companyName: "GreenTech" },
    { id: "deal_abc08", title: "LogiTrack API", stage: "lost", valueCents: 180000, currency: "EUR", probability: 0, expectedClose: "2026-03-30", contactName: "Kai Weber", companyName: "LogiTrack" },
  ],
});
