import { openai } from "@/lib/openai";
import {
  InboundMessage,
  ClassifierOutput,
  PriorityOutput,
} from "@/types/triage";
import { trackTokens } from "@/lib/tokenTracker";

const SYSTEM_PROMPT = `You are a priority specialist for a SaaS company's onboarding team responsible for getting newly signed customers live on the platform within their first 30 days. Category has already been determined. Your ONLY job: determine urgency.

PRIORITY LEVELS:
- P1: customer goes live within 48 hours with a blocking issue, OR any privacy_incident, OR total system failure affecting live operations
- P2: time-sensitive but not immediately blocking — goes live within 1-2 weeks, partial functionality loss
- P3: standard queue, no stated deadline, normal onboarding question
- P4: wrong queue — redirect only, zero onboarding action needed

RULES:
- privacy_incident is always P1 regardless of how calmly it is written
- "goes live tomorrow" or "opens in X days" where X <= 2 = P1
- "haven't heard from anyone" + upcoming go-live date = P1
- wrong_queue categories = P4 always

Return ONLY valid JSON.

{
  "priority": "P1|P2|P3|P4",
  "urgency_reason": "one sentence",
  "time_sensitive": true|false
}`;

export async function priorityAgent(
  message: InboundMessage,
  classification: ClassifierOutput,
  triageId?: string,
): Promise<PriorityOutput> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Category: ${classification.category}
From: ${message.sender_name} <${message.sender_email}>
Subject: ${message.subject}
Body: ${message.body}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  if (triageId && response.usage) {
    await trackTokens(triageId, "priority", "gpt-4o-mini", {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    });
  }

  return JSON.parse(response.choices[0].message.content!) as PriorityOutput;
}
