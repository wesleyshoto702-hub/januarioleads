export type LeadActivityType =
  | "lead_added"
  | "whatsapp_opened"
  | "prompt_generated"
  | "status_changed"
  | "company_updated"
  | "lead_edited"
  | "deep_enrichment"
  | "deep_enrichment_review"
  | "manual_note";

export type LeadActivity = {
  id: number;
  leadId: string;
  userId: string;
  type: LeadActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type LeadActivityPage = {
  items: LeadActivity[];
  hasMore: boolean;
  nextOffset: number;
};

export type CreateLeadActivityInput = {
  leadId: string;
  type: LeadActivityType;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export const LEAD_ACTIVITY_PAGE_SIZE = 20;
