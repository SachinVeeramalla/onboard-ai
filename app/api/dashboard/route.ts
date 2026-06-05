import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("triage_results")
    .select(
      "id, created_at, sender_name, sender_email, subject, category, priority, assigned_to, draft_reply, confidence, flags, needs_human_review, reasoning",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ rows: data });
}
