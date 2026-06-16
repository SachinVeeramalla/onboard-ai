import { NextRequest } from "next/server";
import { orchestrate } from "@/lib/orchestrator";
import { InboundMessage } from "@/types/triage";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Extract authenticated user from session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    messages: InboundMessage[];
    is_reference?: boolean;
  };

  if (!body.messages?.length) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  const isReference = body.is_reference ?? false;

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = async (data: object) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  const process = async () => {
    const results = [];
    for (let i = 0; i < body.messages.length; i++) {
      const msg = body.messages[i];
      await send({
        type: "progress",
        current: i + 1,
        total: body.messages.length,
        sender: msg.sender_name,
      });
      try {
        const result = await orchestrate(msg, undefined, isReference, user.id);
        results.push(result);
        await send({ type: "result", index: i, result });
      } catch (err: any) {
        await send({ type: "error", index: i, error: err.message });
      }
    }
    await send({ type: "complete", total: results.length });
    await writer.close();
  };

  process();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
