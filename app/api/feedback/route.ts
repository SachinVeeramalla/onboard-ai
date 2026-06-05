import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();

  const { error } = await supabase.from("triage_feedback").insert({
    triage_id: body.triage_id,
    rating: body.rating,
    incorrect_field: body.incorrect_field || null,
    correct_value: body.correct_value || null,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
