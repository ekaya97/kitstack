import { createElement } from "react";
import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { ConfirmationView } from "./View";

export { loader } from "./loader";
export type { ConfirmationLoaderSnapshot, ConfirmationViewData } from "./loader";

export default defineView({
  id: "confirmation",
  name: "Debrief Confirmation",
  description: "after the sales call, to edit structured outcomes and confirm customer events",
  loaders: [loader],
  render: (data, host) => createElement(ConfirmationView, { data, host }),
  height: 760,
  placeholder: {
    sessionId: "session-preview",
    customerId: "customer-acme",
    state: "awaiting_confirmation" as const,
    draft: {
      draft_id: "draft-preview",
      session_id: "session-preview",
      status: "draft" as const,
      fields: {
        outcome: "",
        next_step: "",
        customer_update: "",
        discovered_address: "",
        follow_up_date: "",
      },
      updated_at: "2026-09-15T20:15:00.000Z",
    },
    confirmedEventId: null,
    addressEventId: null,
  },
});
