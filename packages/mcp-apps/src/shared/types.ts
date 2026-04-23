export interface Contact {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: number | null;
}

export interface Deal {
  id: string;
  name: string;
  contact_id: string | null;
  value: number | null;
  currency: string;
  stage: "prospect" | "proposal" | "negotiation" | "won" | "lost";
  notes: string | null;
  expected_close_date: string | null;
  created_at: number | null;
  updated_at: number | null;
}

export interface Activity {
  id: string;
  contact_id: string | null;
  deal_id: string | null;
  type: "call" | "email" | "meeting" | "note" | "task";
  description: string;
  created_at: number | null;
}

export interface Proposal {
  id: string;
  deal_id: string | null;
  content: string;
  version: number;
  status: "draft" | "sent" | "accepted" | "rejected";
  created_at: number | null;
}

export type Stage = Deal["stage"];

export const STAGES: Stage[] = ["prospect", "proposal", "negotiation", "won", "lost"];

export const STAGE_LABELS: Record<Stage, string> = {
  prospect: "Prospect",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const STAGE_COLORS: Record<Stage, string> = {
  prospect: "bg-ks-paper-deep text-ks-ink",
  proposal: "bg-blue-50 text-blue-800",
  negotiation: "bg-amber-50 text-amber-800",
  won: "bg-emerald-50 text-emerald-800",
  lost: "bg-red-50 text-red-800",
};
