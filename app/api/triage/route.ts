import { NextRequest } from "next/server";
import { orchestrate } from "@/lib/orchestrator";
import { InboundMessage } from "@/types/triage";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Extract authenticated user from session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as InboundMessage;

  if (!body.body || !body.sender_name) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = async (data: object) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  // Run orchestrator in background, stream steps to client
  // Pass user.id so triage results are stored with the correct user
  orchestrate(
    body,
    async (step, status, output) => {
      await send({ step, status, output });
    },
    false,
    user.id,
  )
    .then(async (result) => {
      await send({ step: "complete", result });
      await writer.close();
    })
    .catch(async (err) => {
      await send({ step: "error", error: err.message });
      await writer.close();
    });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
