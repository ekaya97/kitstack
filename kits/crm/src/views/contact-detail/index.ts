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
      { id: "d1", title: "Acme Brand Strategy", stage: "negotiation", valueCents: 1800000, currency: "EUR" },
      { id: "d6", title: "Acme Q1 Retainer", stage: "won", valueCents: 1200000, currency: "EUR" },
    ],
    activities: [
      { id: "a1", type: "meeting", summary: "Scope review meeting — aligned on 3-phase approach", createdAt: "2026-05-05" },
      { id: "a2", type: "email", summary: "Sent revised pricing with volume discount", createdAt: "2026-05-04" },
      { id: "a6", type: "task", summary: "Send Q1 retainer invoice", createdAt: "2026-04-20" },
    ],
  },
});
