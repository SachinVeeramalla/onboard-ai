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

    // Push to pgmq queue — fast, durable, returns immediately
    // The cron worker picks this up and runs the full triage pipeline
    const { error } = await supabase.rpc("pgmq_send", {
      queue_name: "email_triage",
      msg: {
        message_id: messageId,
        sender_name: senderName,
        sender_email: senderEmail,
        subject,
        body,
        received_at: receivedAt,
      },
    });

    if (error) {
      console.error("Failed to enqueue email:", error.message);
    } else {
      console.log(`Email enqueued: ${messageId}`);
    }

    // Always return 200 so Postmark does not retry
    return Response.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return Response.json({ received: true }, { status: 200 });
  }
}
