/**
 * WhatsApp Integration via Wampli (Meta Cloud API tech provider)
 *
 * Sends WhatsApp template messages using Wampli's "Send Message" API.
 *
 * Required env vars (Wampli dashboard → Settings → API Access & Webhook):
 *   WAMPLI_API_TOKEN     — Account access token
 *   WAMPLI_VENDOR_UID    — Your vendor UID (part of the endpoint path)
 *   WHATSAPP_ENABLED     — Set to "true" to enable (disabled by default)
 *
 * Every call outcome (completed/no-answer/declined) sends the same approved template,
 * Category: MARKETING, 1 body variable (field_1 = recipient's first name):
 *   ai_summit_today — header "TODAY 11 AM: AI Summit", body greets {{1}} about today's summit.
 */

const WAMPLI_API_TOKEN = process.env.WAMPLI_API_TOKEN ?? "";
const WAMPLI_VENDOR_UID = process.env.WAMPLI_VENDOR_UID ?? "";
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";

const WAMPLI_API_BASE_URL = process.env.WAMPLI_API_BASE_URL || "https://wampli.in/api";

// Exact approved body text for the ai_summit_today template — {{1}} is the recipient's name
const AI_SUMMIT_TODAY_BODY = (name: string) => `TODAY. 🔥

Hi ${name}, in a few hours we open the room.

Don't come to take notes.
Come with your laptop. Come ready to build.

By the end of today's session, you'll have things on your laptop that didn't exist this morning.

🖼 🎬 🧑‍💼 🎵 📞 ⚙

We start at 11:00 AM sharp. See you inside.`;

export type WhatsAppMessageType = "call_completed" | "call_missed" | "call_rejected";

interface SendMessageOptions {
  to: string; // Phone number (e.g. +919876543210 or 9876543210)
  type: WhatsAppMessageType;
  callDuration?: number; // seconds
  userName?: string;
}

/**
 * Wampli expects digits only, country code without a leading "+" or "0"
 */
function formatPhone(phone: string): string {
  let digits = phone.replace(/[^0-9]/g, "");
  // If 10 digits, add India country code
  if (digits.length === 10) {
    digits = "91" + digits;
  }
  return digits;
}

/**
 * Every outcome uses the same ai_summit_today template.
 * Wampli's API requires `message_body` (the full resolved text) in addition to the
 * field_1 variable — their dashboard docs omit this, found via a live 400 error.
 */
function getTemplateConfig(options: SendMessageOptions) {
  const name = options.userName?.trim() || "there";
  return {
    template_name: "ai_summit_today",
    fields: { field_1: name },
    message_body: AI_SUMMIT_TODAY_BODY(name),
  };
}

/**
 * Send a WhatsApp message via Wampli
 */
export async function sendWhatsAppMessage(options: SendMessageOptions): Promise<boolean> {
  if (!WHATSAPP_ENABLED) {
    console.log(`[WHATSAPP] Disabled — skipping message to ${options.to} (${options.type})`);
    return false;
  }

  if (!WAMPLI_API_TOKEN || !WAMPLI_VENDOR_UID) {
    console.warn("[WHATSAPP] Missing WAMPLI_API_TOKEN or WAMPLI_VENDOR_UID");
    return false;
  }

  const to = formatPhone(options.to);
  if (to.length < 12) {
    console.warn(`[WHATSAPP] Invalid phone number: ${options.to}`);
    return false;
  }

  const { template_name, fields, message_body } = getTemplateConfig(options);
  const url = `${WAMPLI_API_BASE_URL}/${WAMPLI_VENDOR_UID}/contact/send-message`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WAMPLI_API_TOKEN}`,
      },
      body: JSON.stringify({
        phone_number: to,
        template_name,
        template_language: "en",
        message_body,
        ...fields,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      console.log(`[WHATSAPP] Wampli message sent to ${to} (${options.type}): ${JSON.stringify(data)}`);
      return true;
    } else {
      console.error(`[WHATSAPP] Wampli error for ${to}: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    console.error("[WHATSAPP] Network error:", err);
    return false;
  }
}
