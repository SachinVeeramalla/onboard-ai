import { openai } from "@/lib/openai";
import {
  InboundMessage,
  ClassifierOutput,
  PriorityOutput,
  RouterOutput,
  EscalationOutput,
} from "@/types/triage";
import { trackTokens } from "@/lib/tokenTracker";

const SYSTEM_PROMPT = `You are an escalation specialist for Brightwheel's onboarding team. Your ONLY job: determine what flags apply and whether human review is required.

FLAGS (include all that apply):
- needs_human_review: low confidence classification, ambiguous routing, or sensitive situation
- privacy_incident: parent can see another family's data
- school_opens_soon: school opening within 72 hours
- no_prior_contact: school signed but never heard from onboarding rep
- duplicate_sender: context suggests sender has messaged before without response
- multi_issue: message contains multiple distinct problems
- wrong_queue: does not belong to onboarding team
- vague_message: insufficient detail to act on

needs_human_review = true when:
- Any privacy_incident flag
- Any P1 involving children's safety or data
- Classification confidence was low
- Message is ambiguous enough that wrong routing could cause harm

Return ONLY valid JSON.

{
  "flags": [],
  "needs_human_review": true|false,
  "escalation_reason": "one sentence or empty string"
}`;

export async function escalationAgent(
  message: InboundMessage,
  classification: ClassifierOutput,
  priority: PriorityOutput,
  routing: RouterOutput,
  triageId?: string,
): Promise<EscalationOutput> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Category: ${classification.category}
Confidence: ${classification.confidence}
Priority: ${priority.priority}
Assigned to: ${routing.assigned_to}
From: ${message.sender_name} <${message.sender_email}>
Subject: ${message.subject}
Body: ${message.body}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  if (triageId && response.usage) {
    await trackTokens(triageId, "escalation", "gpt-4o-mini", {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    });
  }

  return JSON.parse(response.choices[0].message.content!) as EscalationOutput;
}
