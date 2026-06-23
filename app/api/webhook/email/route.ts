import { NextRequest } from "next/server";
import { orchestrate } from "@/lib/orchestrator";
import { supabase } from "@/lib/supabase";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getSystemUserId(): Promise<string | undefined> {
  const { data } = await supabase
    .from("triage_results")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(1)
    .single();

  return data?.user_id ?? undefined;
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

  // Constant time comparison to prevent timing attacks
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
    // Verify the request is genuinely from Postmark
    if (!verifySecret(req)) {
      console.warn("Webhook rejected — invalid or missing secret");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();

    // Extract fields from Postmark payload
    const senderName =
      payload.FromName || payload.From?.split("@")[0] || "Unknown";
    const senderEmail = payload.From || "";
    const subject = payload.Subject || "(no subject)";
    const body = payload.TextBody || stripHtml(payload.HtmlBody || "") || "";
    const messageId = payload.MessageID || `email-${Date.now()}`;
    const receivedAt = payload.Date || new Date().toISOString();

    // Reject if missing critical fields
    if (!senderEmail || !body) {
      console.warn(
        `Webhook rejected — missing fields for message ${messageId}`,
      );
      return Response.json(
        { error: "Missing required email fields" },
        { status: 400 },
      );
    }

    // Reject empty or very short bodies — likely automated bounce or receipt
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

    const userId = await getSystemUserId();

    // Fire and forget — respond to Postmark immediately
    // Do not await orchestrate or Postmark will time out
    orchestrate(message, undefined, false, userId, "email")
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

    // Postmark expects 200 immediately
    return Response.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    // Return 200 even on error to prevent Postmark retries
    // Errors are logged internally
    return Response.json({ received: true }, { status: 200 });
  }
}
