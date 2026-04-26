import { defineView } from "../../sdk";
import { loader } from "./loader";
import { ContactDetailView } from "./View";

export default defineView({
  slug: "contact-detail",
  name: "Contact Detail",
  description: "to view detailed contact info with deals and activity",
  loader,
  component: ContactDetailView,
  height: 800,
  placeholder: {
    contact: { id: "c1", name: "Jane Doe", company: "Acme Corp", email: "jane@acme.co", phone: "+49 170 1234567", source: "referral", notes: "Key decision-maker for Q3 rollout", lastContactedAt: "2026-04-20", createdAt: new Date("2026-03-10") },
    deals: [
      { id: "d1", name: "Acme Brand Refresh", contactId: "c1", value: 18000, currency: "EUR", stage: "proposal" as const, notes: "6-week engagement", expectedCloseDate: "2026-05-15", createdAt: new Date("2026-03-20"), updatedAt: new Date("2026-04-10") },
      { id: "d2", name: "Acme Q4 Campaign", contactId: "c1", value: 7500, currency: "EUR", stage: "prospect" as const, notes: null, expectedCloseDate: "2026-09-01", createdAt: new Date("2026-04-05"), updatedAt: new Date("2026-04-05") },
    ],
    recentActivities: [
      { id: "a1", contactId: "c1", dealId: "d1", type: "meeting" as const, description: "Kick-off call — reviewed scope and timeline", createdAt: new Date("2026-04-22") },
      { id: "a2", contactId: "c1", dealId: "d1", type: "email" as const, description: "Sent revised proposal v2 with updated pricing", createdAt: new Date("2026-04-18") },
      { id: "a3", contactId: "c1", dealId: null, type: "call" as const, description: "Quick check-in, discussed Q4 campaign idea", createdAt: new Date("2026-04-15") },
      { id: "a4", contactId: "c1", dealId: "d1", type: "note" as const, description: "Jane prefers async updates over weekly calls", createdAt: new Date("2026-04-10") },
    ],
  },
});
