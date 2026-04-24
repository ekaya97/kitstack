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

// --- Expense Kit ---

export interface Expense {
  id: string;
  date: string;
  description: string;
  gross: number;
  net: number;
  vat_rate: 0 | 7 | 19;
  category: string;
  skr03: string;
  receipt_attached: boolean;
  confirmed: boolean;
}

export interface QuarterlySummary {
  id: string;
  quarter: string;
  year: number;
  total_gross: number;
  total_net: number;
  total_vat: number;
  category_breakdown: { category: string; skr03: string; gross: number; net: number }[];
  monthly_breakdown: { month: string; gross: number; net: number; vat: number }[];
}

export const VAT_COLORS: Record<number, string> = {
  0: "bg-gray-100 text-gray-700",
  7: "bg-amber-50 text-amber-800",
  19: "bg-ks-accent-soft text-ks-accent-deep",
};

// --- Outreach Kit ---

export interface Sequence {
  id: string;
  name: string;
  status: string;
  prospect_count?: number;
  emails?: Email[];
  created_at: string;
}

export interface Email {
  id: string;
  sequence_id: string;
  position: number;
  day_offset: number;
  subject: string;
  body: string;
}

export interface Prospect {
  id: string;
  name: string;
  company: string;
  email: string;
  linkedin: string | null;
  status: "new" | "contacted" | "replied" | "converted";
  personalization_hooks: string[];
  sequence_id: string | null;
}

export type ProspectStatus = Prospect["status"];

export const PROSPECT_STATUS_COLORS: Record<ProspectStatus, string> = {
  new: "bg-ks-paper-deep text-ks-ink",
  contacted: "bg-blue-50 text-blue-800",
  replied: "bg-amber-50 text-amber-800",
  converted: "bg-emerald-50 text-emerald-800",
};

// --- Meeting Kit ---

export interface Meeting {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  decisions: Decision[];
  action_items: ActionItem[];
  open_questions: string[];
  summary: string | null;
}

export interface Decision {
  id: string;
  meeting_id: string;
  description: string;
}

export interface ActionItem {
  id: string;
  meeting_id: string;
  description: string;
  owner: string;
  deadline: string;
  status: "open" | "done" | "overdue";
  meeting_title?: string;
}

export const ACTION_STATUS_COLORS: Record<ActionItem["status"], string> = {
  open: "bg-blue-50 text-blue-800",
  done: "bg-emerald-50 text-emerald-800",
  overdue: "bg-red-50 text-red-800",
};
