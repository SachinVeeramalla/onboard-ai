import { supabase } from "@/lib/supabase";

export type ReferenceExample = {
  subject: string;
  body: string;
  category: string;
  confidence: string;
  reasoning: string;
};

export async function getRelevantExamples(
  message: { subject: string; body: string },
  limit: number = 3,
): Promise<ReferenceExample[]> {
  const { data, error } = await supabase
    .from("triage_results")
    .select("subject, body, category, confidence, reasoning")
    .eq("is_reference", true)
    .order("created_at", { ascending: true })
    .limit(25);

  if (error || !data || data.length === 0) return [];

  // Score each reference message by keyword overlap with the incoming message
  const incomingText = `${message.subject} ${message.body}`.toLowerCase();
  const incomingWords = new Set(
    incomingText.split(/\s+/).filter((w) => w.length > 4),
  );

  const scored = data.map((row) => {
    const rowText = `${row.subject} ${row.body}`.toLowerCase();
    const rowWords = rowText.split(/\s+/).filter((w) => w.length > 4);
    const overlap = rowWords.filter((w) => incomingWords.has(w)).length;
    return { ...row, score: overlap };
  });

  // Sort by overlap score descending, take top N
  const top = scored.sort((a, b) => b.score - a.score).slice(0, limit);

  // If no overlap found, fall back to one example per major category
  if (top.every((r) => r.score === 0)) {
    const categories = [
      "urgent_escalation",
      "billing_issue",
      "technical_bug",
      "setup_question",
      "privacy_incident",
      "wrong_queue_sales",
      "vague_insufficient",
    ];
    const fallback: ReferenceExample[] = [];
    for (const cat of categories.slice(0, limit)) {
      const match = data.find((r) => r.category === cat);
      if (match) fallback.push(match);
    }
    return fallback;
  }

  return top;
}

export function formatExamplesForPrompt(examples: ReferenceExample[]): string {
  if (examples.length === 0) return "";

  const lines = examples
    .map(
      (ex, i) => `
Example ${i + 1}:
Subject: ${ex.subject}
Body: ${ex.body.slice(0, 200)}${ex.body.length > 200 ? "..." : ""}
→ category: ${ex.category}, confidence: ${ex.confidence}
Reasoning: ${ex.reasoning}`,
    )
    .join("\n");

  return `\nREFERENCE EXAMPLES FROM YOUR DATASET (use these to calibrate your classification):\n${lines}\n`;
}
