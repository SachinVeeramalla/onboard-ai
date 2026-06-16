import { openai } from "@/lib/openai";
import {
  InboundMessage,
  ClassifierOutput,
  PriorityOutput,
  RouterOutput,
} from "@/types/triage";
import { trackTokens } from "@/lib/tokenTracker";

const SYSTEM_PROMPT = `You are a routing specialist for a SaaS company's onboarding team responsible for getting newly signed customers live on the platform within their first 30 days. Category and priority are already determined. Your ONLY job: decide who handles this.

OWNERS:
- onboarding_specialist: setup questions, how-to, general onboarding guidance
- technical_support: bugs, crashes, features broken
- billing_team: charges, invoices, plan questions, billing start dates
- account_management_team: admin transfers, ownership changes
- sales_team: new prospects wanting to buy — redirect, not handle
- legal_compliance: privacy incidents — always route here AND onboarding_specialist
- hr_team: job applications — redirect only

RULES:
- privacy_incident routes to BOTH legal_compliance (primary) AND onboarding_specialist (secondary)
- P1 urgent_escalation routes to onboarding_specialist with technical_support as secondary if technical issue involved
- multi_topic: route to owner of the highest priority issue, note secondary issues

Return ONLY valid JSON.

{
  "assigned_to": "",
  "secondary_owner": "",
  "routing_reason": "one sentence"
}`;

export async function routerAgent(
  message: InboundMessage,
  classification: ClassifierOutput,
  priority: PriorityOutput,
  triageId?: string,
): Promise<RouterOutput> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Category: ${classification.category}
Priority: ${priority.priority}
From: ${message.sender_name} <${message.sender_email}>
Subject: ${message.subject}
Body: ${message.body}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  if (triageId && response.usage) {
    await trackTokens(triageId, "router", "gpt-4o-mini", {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    });
  }

  return JSON.parse(response.choices[0].message.content!) as RouterOutput;
}
