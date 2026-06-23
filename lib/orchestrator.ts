import { classifierAgent } from "./agents/classifier";
import { priorityAgent } from "./agents/priority";
import { routerAgent } from "./agents/router";
import { replyAgent } from "./agents/reply";
import { escalationAgent } from "./agents/escalation";
import { supabase } from "./supabase";
import { InboundMessage, TriageResult } from "@/types/triage";

export async function orchestrate(
  message: InboundMessage,
  onStep?: (step: string, status: string, output?: string) => void,
  isReference = false,
  userId?: string,
  source = "manual",
): Promise<TriageResult> {
  const step = (name: string, status: string, output?: string) => {
    onStep?.(name, status, output);
  };

  // Store a placeholder first to get the triageId for token tracking
  const triageId = await reserveTriageId(message, isReference, userId, source);

  step("classifier", "running");
  const classification = await classifierAgent(message, triageId);
  step(
    "classifier",
    "complete",
    `${classification.category} — ${classification.confidence} confidence`,
  );

  // Short circuit: privacy incident goes straight to escalation
  if (classification.category === "privacy_incident") {
    step("priority", "running");
    const priority = {
      priority: "P1" as const,
      urgency_reason: "Privacy incident — data exposure",
      time_sensitive: true,
    };
    step("priority", "complete", "P1 — privacy incident");

    step("router", "running");
    const routing = {
      assigned_to: "legal_compliance",
      secondary_owner: "onboarding_specialist",
      routing_reason: "Data exposure requires legal review",
    };
    step("router", "complete", "legal_compliance + onboarding_specialist");

    step("reply", "running");
    const reply = {
      draft_reply:
        "ESCALATED TO COMPLIANCE — do not respond via standard channel. Legal team has been notified.",
      reply_tone: "compliance" as const,
    };
    step("reply", "complete", "Compliance escalation");

    step("escalation", "running");
    const escalation = {
      flags: ["privacy_incident", "needs_human_review"],
      needs_human_review: true,
      escalation_reason: "Privacy incident requires immediate legal review",
    };
    step("escalation", "complete", "Privacy incident flagged");

    const result: TriageResult = {
      message,
      classification,
      priority,
      routing,
      reply,
      escalation,
    };

    await finalizeResult(triageId, result, isReference, userId, source);
    return result;
  }

  step("priority", "running");
  const priority = await priorityAgent(message, classification, triageId);
  step(
    "priority",
    "complete",
    `${priority.priority} — ${priority.urgency_reason}`,
  );

  step("router", "running");
  const routing = await routerAgent(
    message,
    classification,
    priority,
    triageId,
  );
  step("router", "complete", routing.assigned_to);

  step("reply", "running");
  const reply = await replyAgent(
    message,
    classification,
    priority,
    routing,
    triageId,
  );
  step("reply", "complete", "Draft ready");

  step("escalation", "running");
  const escalation = await escalationAgent(
    message,
    classification,
    priority,
    routing,
    triageId,
  );
  step(
    "escalation",
    "complete",
    escalation.flags.length > 0 ? escalation.flags.join(", ") : "No flags",
  );

  const result: TriageResult = {
    message,
    classification,
    priority,
    routing,
    reply,
    escalation,
  };

  await finalizeResult(triageId, result, isReference, userId, source);
  return result;
}

// Insert a placeholder row immediately to get a UUID for token tracking
async function reserveTriageId(
  message: InboundMessage,
  isReference: boolean,
  userId?: string,
  source = "manual",
): Promise<string> {
  const { data } = await supabase
    .from("triage_results")
    .insert({
      message_id: message.message_id,
      received_at: message.received_at,
      sender_name: message.sender_name,
      sender_email: message.sender_email,
      subject: message.subject,
      body: message.body,
      is_reference: isReference,
      user_id: userId ?? null,
      source,
      // Placeholder values — updated by finalizeResult
      category: "pending",
      priority: "P3",
      assigned_to: "pending",
      secondary_owner: "",
      draft_reply: "",
      confidence: "low",
      flags: [],
      reasoning: "",
      needs_human_review: false,
    })
    .select("id")
    .single();

  return data?.id ?? crypto.randomUUID();
}

// Update the placeholder row with the final triage output
async function finalizeResult(
  triageId: string,
  result: TriageResult,
  isReference: boolean,
  userId?: string,
  source = "manual",
) {
  await supabase
    .from("triage_results")
    .update({
      category: result.classification.category,
      priority: result.priority.priority,
      assigned_to: result.routing.assigned_to,
      secondary_owner: result.routing.secondary_owner,
      draft_reply: result.reply.draft_reply,
      confidence: result.classification.confidence,
      flags: result.escalation.flags,
      reasoning: result.classification.reasoning,
      needs_human_review: result.escalation.needs_human_review,
      is_reference: isReference,
      user_id: userId ?? null,
      source,
    })
    .eq("id", triageId);

  if (
    result.priority.priority === "P1" ||
    result.escalation.flags.includes("privacy_incident")
  ) {
    await supabase.from("escalations").insert({
      triage_id: triageId,
      reason: result.escalation.escalation_reason,
      escalation_type: result.escalation.flags.includes("privacy_incident")
        ? "privacy"
        : "urgent",
      user_id: userId ?? null,
    });
  }

  if (result.classification.category.startsWith("wrong_queue")) {
    await supabase.from("wrong_queue_log").insert({
      triage_id: triageId,
      redirect_to: result.routing.assigned_to,
      redirect_reason: result.routing.routing_reason,
      user_id: userId ?? null,
    });
  }
}
