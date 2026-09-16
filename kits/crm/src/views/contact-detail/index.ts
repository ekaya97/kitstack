import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { ContactDetailView } from "./View";

export default defineView({
  slug: "contact-detail",
  name: "Contact Detail",
  description: "to see a contact's details, associated deals, and interaction history",
  loader,
  component: ContactDetailView,
  height: 550,
  placeholder: {
    contact: {
      id: "c1", firstName: "Anna", lastName: "Müller", email: "anna@acme.de",
      phone: "+49 170 1234567", role: "Head of Brand", relationship: "warm",
      source: "LinkedIn", notes: "Met at SaaStr EU. Interested in brand strategy.",
      companyName: "Acme GmbH",
    },
    deals: [
      {
        id: "d1", companyId: null, contactId: "c1", title: "Acme Brand Strategy",
        valueCents: 1800000, currency: "EUR", stage: "negotiation", probability: 70,
        expectedClose: "2026-06-01", lostReason: null, notes: null,
        archivedAt: null, createdAt: "2026-04-01", updatedAt: "2026-05-05",
      },
      {
        id: "d6", companyId: null, contactId: "c1", title: "Acme Q1 Retainer",
        valueCents: 1200000, currency: "EUR", stage: "won", probability: 100,
        expectedClose: "2026-05-15", lostReason: null, notes: null,
        archivedAt: null, createdAt: "2026-03-01", updatedAt: "2026-05-05",
      },
    ],
    activities: [
      {
        id: "a1", contactId: "c1", type: "meeting",
        summary: "Scope review meeting — aligned on 3-phase approach",
        sentiment: "positive", followUp: null, followUpBy: null,
        occurredAt: "2026-05-05", createdAt: "2026-05-05", updatedAt: "2026-05-05",
      },
      {
        id: "a2", contactId: "c1", type: "email",
        summary: "Sent revised pricing with volume discount",
        sentiment: null, followUp: null, followUpBy: null,
        occurredAt: "2026-05-04", createdAt: "2026-05-04", updatedAt: "2026-05-04",
      },
      {
        id: "a6", contactId: "c1", type: "task",
        summary: "Send Q1 retainer invoice",
        sentiment: null, followUp: "Send invoice", followUpBy: "2026-05-10",
        occurredAt: "2026-04-20", createdAt: "2026-04-20", updatedAt: "2026-04-20",
      },
    ],
  },
});
