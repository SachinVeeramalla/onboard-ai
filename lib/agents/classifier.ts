import { openai } from "@/lib/openai";
import { InboundMessage, ClassifierOutput } from "@/types/triage";
import { trackTokens } from "@/lib/tokenTracker";
import {
  getRelevantExamples,
  formatExamplesForPrompt,
} from "@/lib/referenceDataset";

const SYSTEM_PROMPT = `You are a classification specialist for a SaaS company's onboarding team responsible for getting newly signed customers live on the platform within their first 30 days. Inbound messages come from administrators, directors, and staff who need help with setup, billing, technical issues, and urgent escalations.

Your ONLY job: identify what category this inbound message belongs to.

CATEGORIES:
- setup_question: how to use platform features, adding staff, importing data, configuring settings
- billing_issue: double charges, invoices, plan mismatches, billing start date questions
- technical_bug: something broken that previously worked — login failures, app crashes, features not loading
- urgent_escalation: customer goes live within 72 hours with a critical blocking issue
- account_management: admin or ownership transfers, access changes, account takeovers
- wrong_queue_sales: person wants to buy the product, not an existing customer
- wrong_queue_hr: job application or employment inquiry
- follow_up: sender explicitly following up on a prior unanswered message
- privacy_incident: a user can see data belonging to another customer — treat as highest severity regardless of tone
- multi_topic: message contains 2 or more distinct issues requiring separate actions
- vague_insufficient: message lacks enough detail to act on meaningfully

CONFIDENCE CALIBRATION:
- high: clear single category, unambiguous signals, full context present, no overlap with other categories
- medium: category is likely but message has mixed signals, missing context, could fit two categories, or the issue type is unclear without more information
- low: message is vague, too short to classify meaningfully, lacks sender context, no description of the actual problem, or you are genuinely uncertain between categories

IMPORTANT: Always read the full message body before assigning confidence.
A vague subject line does not make a message vague_insufficient if the body contains specific, actionable questions. A message with 2+ distinct clear questions should be classified as multi_topic, not vague_insufficient.

vague_insufficient is ONLY for messages where the body itself provides no useful information — not messages with vague subject lines.

Examples of HIGH confidence:
- "We go live tomorrow and 40 users cannot log in" → urgent_escalation, high
- "I saw your listing on Indeed and want to apply" → wrong_queue_hr, high
- "We were charged twice this month" → billing_issue, high
- "A user can see another customer's data in the app" → privacy_incident, high
- "I have three questions: 1) how do I assign users to groups 2) what can clients see 3) when does billing start" → multi_topic, high

Examples of MEDIUM confidence:
- A message with both a billing question and a setup question → multi_topic, medium
- A login issue that could be technical_bug or setup_question depending on whether it ever worked → medium
- A follow_up message with no reference to what the original issue was → follow_up, medium
- "We upgraded our plan but features are not showing up" → could be billing_issue or technical_bug → medium

Examples of LOW confidence:
- "Having some issues with the system, please contact us" with no detail → vague_insufficient, low
- A one-line message with no subject and no description of the problem → low
- A message where it is completely unclear if the sender is an existing customer or a prospect → low

Return ONLY valid JSON. No explanation outside the JSON.

{
  "category": "",
  "confidence": "high|medium|low",
  "reasoning": "one sentence explaining the classification"
}`;

export async function classifierAgent(
  message: InboundMessage,
  triageId?: string,
): Promise<ClassifierOutput> {
  const start = Date.now();

  const examples = await getRelevantExamples({
    subject: message.subject,
    body: message.body,
  });
  const exampleContext = formatExamplesForPrompt(examples);

  const userMessage = `${exampleContext}
Now classify this new message:
From: ${message.sender_name} <${message.sender_email}>
Subject: ${message.subject}
Body: ${message.body}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const result = JSON.parse(
    response.choices[0].message.content!,
  ) as ClassifierOutput;

  if (triageId && response.usage) {
    await trackTokens(triageId, "classifier", "gpt-4o-mini", {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    });
  }

  console.log(
    `Classifier: ${result.category} (${result.confidence}) — ${Date.now() - start}ms | ${examples.length} reference examples used`,
  );

  return result;
}
