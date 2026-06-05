import { supabase } from "@/lib/supabase";

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
};

export async function trackTokens(
  triageId: string,
  agentName: string,
  model: string,
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  },
) {
  const rates = COST_PER_1K[model] || { input: 0, output: 0 };
  const estimatedCost =
    (usage.prompt_tokens / 1000) * rates.input +
    (usage.completion_tokens / 1000) * rates.output;

  await supabase.from("token_usage").insert({
    triage_id: triageId,
    agent_name: agentName,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    model,
    estimated_cost_usd: estimatedCost,
  });

  console.log(
    `[${agentName}] ${usage.total_tokens} tokens | $${estimatedCost.toFixed(6)}`,
  );
}
