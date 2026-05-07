import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { DashboardView } from "./View";

export default defineView({
  slug: "dashboard",
  name: "Dashboard",
  description: "for an overview of pipeline totals, stage breakdown, and recent activity",
  loader,
  component: DashboardView,
  height: 550,
  placeholder: {
    deals: [
      { id: "d1", title: "Acme Brand Strategy", stage: "negotiation", valueCents: 1800000, currency: "EUR" },
      { id: "d2", title: "NovaTech Dashboard", stage: "proposal", valueCents: 1450000, currency: "EUR" },
      { id: "d3", title: "BK Website Redesign", stage: "lead", valueCents: 2200000, currency: "EUR" },
      { id: "d4", title: "FinFlow Consulting", stage: "lead", valueCents: 800000, currency: "EUR" },
      { id: "d5", title: "Scala Market Entry", stage: "negotiation", valueCents: 3500000, currency: "EUR" },
      { id: "d6", title: "Acme Q1 Retainer", stage: "won", valueCents: 1200000, currency: "EUR" },
      { id: "d7", title: "NovaTech SEO Audit", stage: "won", valueCents: 450000, currency: "EUR" },
      { id: "d8", title: "Harris Dev Sprint", stage: "lost", valueCents: 600000, currency: "EUR" },
    ],
    activities: [
      { id: "a1", type: "meeting", summary: "Scope review — aligned on 3-phase approach", contactId: "c1", firstName: "Anna", lastName: "Müller", createdAt: "2026-05-05" },
      { id: "a2", type: "email", summary: "Sent revised pricing with volume discount", contactId: "c1", firstName: "Anna", lastName: "Müller", createdAt: "2026-05-04" },
      { id: "a3", type: "email", summary: "Sent proposal v2 with updated timeline", contactId: "c2", firstName: "James", lastName: "Chen", createdAt: "2026-05-03" },
      { id: "a4", type: "call", summary: "Discussed payment terms — NET 30 agreed", contactId: "c5", firstName: "Elena", lastName: "Rossi", createdAt: "2026-05-02" },
      { id: "a5", type: "note", summary: "Sophie mentioned content strategy partner need", contactId: "c3", firstName: "Sophie", lastName: "Laurent", createdAt: "2026-05-01" },
    ],
  },
});
