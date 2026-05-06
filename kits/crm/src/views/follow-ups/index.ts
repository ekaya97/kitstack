import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { FollowUpsView } from "./View";

export default defineView({
  slug: "follow-ups",
  name: "Follow-ups",
  description: "to see overdue and upcoming follow-ups with the ability to mark them done",
  loader,
  component: FollowUpsView,
  height: 450,
  placeholder: [
    { id: "int_001", contactId: "con_001", firstName: "Anna", lastName: "Müller", followUp: "Send revised proposal with updated pricing", followUpBy: "2026-05-02", summary: "Discussed project scope over coffee", type: "coffee", occurredAt: "2026-04-28" },
    { id: "int_002", contactId: "con_004", firstName: "Marc", lastName: "Bauer", followUp: "Schedule product demo for the team", followUpBy: "2026-05-04", summary: "Initial call about POS rewrite needs", type: "call", occurredAt: "2026-04-25" },
    { id: "int_003", contactId: "con_003", firstName: "Lisa", lastName: "Chen", followUp: "Share case study from similar fintech project", followUpBy: "2026-05-08", summary: "Met at FinTech Meetup Berlin", type: "event", occurredAt: "2026-05-01" },
    { id: "int_004", contactId: "con_006", firstName: "Tom", lastName: "Richter", followUp: "Review technical architecture doc he shared", followUpBy: "2026-05-12", summary: "Deep dive on migration requirements", type: "meeting", occurredAt: "2026-05-03" },
    { id: "int_005", contactId: "con_005", firstName: "Sophie", lastName: "Müller", followUp: "Send final contract for signing", followUpBy: "2026-05-15", summary: "Agreed on branding deliverables and timeline", type: "meeting", occurredAt: "2026-05-05" },
  ],
});
