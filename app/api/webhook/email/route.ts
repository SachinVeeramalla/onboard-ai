export const runtime = "nodejs";
export const maxDuration = 10;

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function verifySecret(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.error("WEBHOOK_SECRET environment variable is not set");
    return false;
  }

  if (!secret) return false;
  if (secret.length !== expectedSecret.length) return false;

  let mismatch = 0;
  for (let i = 0; i < secret.length; i++) {
    mismatch |= secret.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
  }

  return mismatch === 0;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifySecret(req)) {
      console.warn("Webhook rejected — invalid or missing secret");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();

    const senderName =
      payload.FromName || payload.From?.split("@")[0] || "Unknown";
    const senderEmail = payload.From || "";
    const subject = payload.Subject || "(no subject)";
    const body = payload.TextBody || stripHtml(payload.HtmlBody || "") || "";
    const messageId = payload.MessageID || `email-${Date.now()}`;
    const receivedAt = payload.Date || new Date().toISOString();

    if (!senderEmail || !body || body.trim().length < 10) {
      return Response.json({ received: true }, { status: 200 });
    }

    const msg = {
      message_id: messageId,
      sender_name: senderName,
      sender_email: senderEmail,
      subject,
      body,
      received_at: receivedAt,
    };

    console.log(`Attempting to enqueue message: ${messageId}`);

    // Try pgmq_send wrapper
    const { data, error } = await supabase.rpc("pgmq_send", {
      queue_name: "email_triage",
      msg,
    });

    if (error) {
      console.error("pgmq_send failed:", JSON.stringify(error));
      // Fall back to direct insert into triage_results as pending
      // so the message is not lost
      const { error: insertError } = await supabase
        .from("triage_results")
        .insert({
          message_id: messageId,
          received_at: receivedAt,
          sender_name: senderName,
          sender_email: senderEmail,
          subject,
          body,
          source: "email",
          category: "pending",
          priority: "P3",
          assigned_to: "pending",
          secondary_owner: "",
          draft_reply: "",
          confidence: "low",
          flags: [],
          reasoning: "",
          needs_human_review: false,
          user_id: null,
          is_reference: false,
        });

      if (insertError) {
        console.error(
          "Fallback insert also failed:",
          JSON.stringify(insertError),
        );
      } else {
        console.log(`Fallback: saved ${messageId} directly to triage_results`);
      }
    } else {
      console.log(`Enqueued successfully: ${messageId}, msg_id: ${data}`);
    }

    return Response.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return Response.json({ received: true }, { status: 200 });
  }
}
