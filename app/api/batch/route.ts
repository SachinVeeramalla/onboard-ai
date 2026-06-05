import { NextRequest } from "next/server";
import { orchestrate } from "@/lib/orchestrator";
import { InboundMessage } from "@/types/triage";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
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
        const result = await orchestrate(msg, undefined, isReference);
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
