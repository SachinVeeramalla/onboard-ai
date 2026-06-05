export interface InboundMessage {
  message_id?: string;
  received_at?: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  body: string;
}

export interface ClassifierOutput {
  category: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

export interface PriorityOutput {
  priority: "P1" | "P2" | "P3" | "P4";
  urgency_reason: string;
  time_sensitive: boolean;
}

export interface RouterOutput {
  assigned_to: string;
  secondary_owner: string;
  routing_reason: string;
}

export interface ReplyOutput {
  draft_reply: string;
  reply_tone: string;
}

export interface EscalationOutput {
  flags: string[];
  needs_human_review: boolean;
  escalation_reason: string;
}

export interface TriageResult {
  message: InboundMessage;
  classification: ClassifierOutput;
  priority: PriorityOutput;
  routing: RouterOutput;
  reply: ReplyOutput;
  escalation: EscalationOutput;
}

export type AgentStep = {
  name: string;
  status: "pending" | "running" | "complete" | "error";
  output?: string;
};
