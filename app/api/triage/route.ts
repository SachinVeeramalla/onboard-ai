import { NextRequest } from "next/server";
import { orchestrate } from "@/lib/orchestrator";
import { InboundMessage } from "@/types/triage";

export async function POST(req: NextRequest) {
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
  orchestrate(body, async (step, status, output) => {
    await send({ step, status, output });
  })
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
