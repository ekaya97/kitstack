export interface DebriefDraftUpdate {
  readonly outcome?: string;
  readonly next_step?: string;
  readonly customer_update?: string;
  readonly discovered_address?: string;
  readonly follow_up_date?: string;
}

export interface DebriefConfirmationResult {
  readonly session_id: string;
  readonly customer_id: string | null;
  readonly state: "awaiting_confirmation" | "partial" | "confirmed";
  readonly draft: {
    readonly draft_id: string;
    readonly session_id: string;
    readonly status: "draft" | "confirmed" | "partial";
    readonly fields: Readonly<Record<string, unknown>>;
    readonly updated_at: string;
  };
  readonly confirmed_event_id?: string;
  readonly address_event_id?: string;
  readonly kit_view: {
    readonly kit_id: "debrief";
    readonly view: string;
    readonly reason?: string;
  };
}
