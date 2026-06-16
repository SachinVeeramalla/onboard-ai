import { createClient } from "@/lib/supabase/server";

export async function GET() {
  // Extract authenticated user from session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("triage_results")
    .select(
      "id, created_at, sender_name, sender_email, subject, category, priority, assigned_to, draft_reply, confidence, flags, needs_human_review, reasoning",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ rows: data });
}
