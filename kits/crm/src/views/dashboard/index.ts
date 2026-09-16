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
      { id: "d1", companyId: null, contactId: "c1", title: "Acme Brand Strategy", valueCents: 1800000, currency: "EUR", stage: "negotiation", probability: 70, expectedClose: "2026-06-01", lostReason: null, notes: null, archivedAt: null, createdAt: "2026-04-01", updatedAt: "2026-05-05" },
      { id: "d2", companyId: null, contactId: "c2", title: "NovaTech Dashboard", valueCents: 1450000, currency: "EUR", stage: "proposal", probability: 50, expectedClose: "2026-06-15", lostReason: null, notes: null, archivedAt: null, createdAt: "2026-04-02", updatedAt: "2026-05-04" },
      { id: "d3", companyId: null, contactId: "c3", title: "BK Website Redesign", valueCents: 2200000, currency: "EUR", stage: "lead", probability: 20, expectedClose: null, lostReason: null, notes: null, archivedAt: null, createdAt: "2026-04-03", updatedAt: "2026-05-03" },
      { id: "d4", companyId: null, contactId: "c4", title: "FinFlow Consulting", valueCents: 800000, currency: "EUR", stage: "lead", probability: 20, expectedClose: null, lostReason: null, notes: null, archivedAt: null, createdAt: "2026-04-04", updatedAt: "2026-05-02" },
      { id: "d5", companyId: null, contactId: "c5", title: "Scala Market Entry", valueCents: 3500000, currency: "EUR", stage: "negotiation", probability: 70, expectedClose: "2026-07-01", lostReason: null, notes: null, archivedAt: null, createdAt: "2026-04-05", updatedAt: "2026-05-01" },
      { id: "d6", companyId: null, contactId: "c1", title: "Acme Q1 Retainer", valueCents: 1200000, currency: "EUR", stage: "won", probability: 100, expectedClose: "2026-05-15", lostReason: null, notes: null, archivedAt: null, createdAt: "2026-03-01", updatedAt: "2026-05-05" },
      { id: "d7", companyId: null, contactId: "c2", title: "NovaTech SEO Audit", valueCents: 450000, currency: "EUR", stage: "won", probability: 100, expectedClose: "2026-05-10", lostReason: null, notes: null, archivedAt: null, createdAt: "2026-03-02", updatedAt: "2026-05-04" },
      { id: "d8", companyId: null, contactId: "c4", title: "Harris Dev Sprint", valueCents: 600000, currency: "EUR", stage: "lost", probability: 0, expectedClose: "2026-04-30", lostReason: "Budget", notes: null, archivedAt: null, createdAt: "2026-03-03", updatedAt: "2026-04-30" },
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
