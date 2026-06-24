export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest } from "next/server";
import { orchestrate } from "@/lib/orchestrator";
import { supabase } from "@/lib/supabase";

type QueueMessage = {
  msg_id: number;
  message: {
    message_id: string;
    sender_name: string;
    sender_email: string;
    subject: string;
    body: string;
    received_at: string;
  };
};

export async function GET(req: NextRequest) {
  // Verify this is a legitimate Vercel cron call
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Read up to 5 messages from the queue
    // Messages are locked for 60 seconds
    // If processing fails they automatically become visible again for retry
    const { data: messages, error } = await supabase.rpc("pgmq_read", {
      queue_name: "email_triage",
      sleep_seconds: 60,
      n: 5,
    });

    if (error) {
      console.error("Failed to read from queue:", error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return Response.json({ processed: 0, message: "Queue empty" });
    }

    console.log(`Processing ${messages.length} emails from queue`);

    let processed = 0;
    let failed = 0;

    for (const item of messages as QueueMessage[]) {
      const { msg_id, message } = item;

      try {
        // Run the full 5-agent triage pipeline
        await orchestrate(
          {
            message_id: message.message_id,
            sender_name: message.sender_name,
            sender_email: message.sender_email,
            subject: message.subject,
            body: message.body,
            received_at: message.received_at,
          },
          undefined,
          false,
          undefined,
          "email",
        );

        // Archive the message — removes it from the queue permanently
        // Only archive after successful processing
        await supabase.rpc("pgmq_archive", {
          queue_name: "email_triage",
          msg_id,
        });

        console.log(`Processed and archived: ${message.message_id}`);
        processed++;
      } catch (err: any) {
        // Do NOT archive on failure
        // pgmq automatically retries after the visibility timeout (60s)
        console.error(`Failed to process ${message.message_id}:`, err.message);
        failed++;
      }
    }

    return Response.json({ processed, failed });
  } catch (err: any) {
    console.error("Cron worker error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
