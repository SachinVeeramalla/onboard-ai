export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest } from "next/server";
import { orchestrate } from "@/lib/orchestrator";
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

  if (!secret) {
    return false;
  }

  if (secret.length !== expectedSecret.length) {
    return false;
  }

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

    if (!senderEmail || !body) {
      console.warn(
        `Webhook rejected — missing fields for message ${messageId}`,
      );
      return Response.json(
        { error: "Missing required email fields" },
        { status: 400 },
      );
    }

    if (body.trim().length < 10) {
      console.warn(
        `Webhook rejected — body too short for message ${messageId}`,
      );
      return Response.json({ received: true }, { status: 200 });
    }

    const message = {
      message_id: messageId,
      sender_name: senderName,
      sender_email: senderEmail,
      subject,
      body,
      received_at: receivedAt,
    };

    // Await the full pipeline before responding to Postmark
    // maxDuration = 30 keeps the Vercel function alive long enough
    // Promise.race with 25s timeout ensures we always respond before Postmark's 30s limit
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, 25000),
    );

    const triagePromise = orchestrate(
      message,
      undefined,
      false,
      undefined,
      "email",
    )
      .then(async () => {
        await supabase
          .from("triage_results")
          .update({ source: "email" })
          .eq("message_id", messageId);
        console.log(`Email triaged successfully: ${messageId}`);
      })
      .catch((err) => {
        console.error(`Email triage failed for ${messageId}:`, err.message);
      });

    await Promise.race([triagePromise, timeoutPromise]);

    return Response.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return Response.json({ received: true }, { status: 200 });
  }
}
