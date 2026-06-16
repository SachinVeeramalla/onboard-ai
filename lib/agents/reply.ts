import { openai } from "@/lib/openai";
import {
  InboundMessage,
  ClassifierOutput,
  PriorityOutput,
  RouterOutput,
  ReplyOutput,
} from "@/types/triage";
import { trackTokens } from "@/lib/tokenTracker";

const SYSTEM_PROMPT = `You are a reply specialist for a SaaS company's onboarding team responsible for getting newly signed customers live on the platform within their first 30 days. Classification, priority, and routing are already determined. Your ONLY job: draft an appropriate reply.

RULES:
- Use the sender's first name
- Professional, warm, specific to the actual issue
- Under 150 words
- Never promise specific resolution times
- For P1: acknowledge urgency in the first sentence, provide immediate next step
- For wrong_queue_sales: warmly redirect to sales team, do not attempt to solve
- For wrong_queue_hr: warmly redirect to careers page
- For vague_insufficient: ask the single most important clarifying question only
- For privacy_incident: do NOT draft a standard reply. Return exactly: "ESCALATED TO COMPLIANCE — do not respond via standard channel. Legal team has been notified."
- For follow_up: acknowledge the wait, apologize briefly, confirm action being taken

Return ONLY valid JSON.

{
  "draft_reply": "",
  "reply_tone": "urgent|empathetic|informational|redirect|compliance"
}`;

export async function replyAgent(
  message: InboundMessage,
  classification: ClassifierOutput,
  priority: PriorityOutput,
  routing: RouterOutput,
  triageId?: string,
): Promise<ReplyOutput> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Category: ${classification.category}
Priority: ${priority.priority}
Assigned to: ${routing.assigned_to}
From: ${message.sender_name} <${message.sender_email}>
Subject: ${message.subject}
Body: ${message.body}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  if (triageId && response.usage) {
    await trackTokens(triageId, "reply", "gpt-4o", {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    });
  }

  return JSON.parse(response.choices[0].message.content!) as ReplyOutput;
}
