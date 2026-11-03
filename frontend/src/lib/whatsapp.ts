/**
 * WhatsApp Integration via Wampli (Meta Cloud API tech provider)
 *
 * Sends WhatsApp template messages using Wampli's "Send Message" API.
 *
 * Required env vars (Wampli dashboard → Settings → API Access & Webhook):
 *   WAMPLI_API_TOKEN     — Account access token
 *   WAMPLI_VENDOR_UID    — Your vendor UID (part of the endpoint path)
 *   WAMPLI_BUSINESS_NAME — Fills the business-name template variable (optional, defaults to "Nova AI")
 *   WHATSAPP_ENABLED     — Set to "true" to enable (disabled by default)
 *
 * Before sending, connect your WhatsApp Business number via Wampli's Embedded Signup,
 * then create + get Meta approval for these templates (Wampli dashboard → Templates),
 * all Category: Utility, body variables field_1/field_2 (in order):
 *   call_completed  — "Thank you for calling {{1}}. Your call lasted {{2}} minutes."
 *   call_no_answer  — "We tried calling you from {{1}} but couldn't connect. Reply CALLBACK and we'll call you back."
 *   call_declined   — "We tried reaching you from {{1}}. Reply CALLBACK to schedule a better time, or STOP to opt out."
 */

const WAMPLI_API_TOKEN = process.env.WAMPLI_API_TOKEN ?? "";
const WAMPLI_VENDOR_UID = process.env.WAMPLI_VENDOR_UID ?? "";
const WAMPLI_BUSINESS_NAME = process.env.WAMPLI_BUSINESS_NAME || "Nova AI";
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";

const WAMPLI_API_BASE_URL = process.env.WAMPLI_API_BASE_URL || "https://wampli.in/api";

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
 * Get Wampli template name + body field values for each event type.
 * Wampli's API requires `message_body` (the full resolved text) in addition to the
 * field_1/field_2 variables — their dashboard docs omit this, found via a live 400 error.
 */
function getTemplateConfig(type: WhatsAppMessageType, options: SendMessageOptions) {
  switch (type) {
    case "call_completed": {
      const mins = options.callDuration ? Math.ceil(options.callDuration / 60) : 0;
      return {
        template_name: "call_completed",
        fields: { field_1: WAMPLI_BUSINESS_NAME, field_2: String(mins) },
        message_body: `Thank you for calling ${WAMPLI_BUSINESS_NAME}. Your call lasted ${mins} minutes.`,
      };
    }
    case "call_missed":
      return {
        template_name: "call_no_answer",
        fields: { field_1: WAMPLI_BUSINESS_NAME },
        message_body: `We tried calling you from ${WAMPLI_BUSINESS_NAME} but couldn't connect. Reply CALLBACK and we'll call you back.`,
      };
    case "call_rejected":
      return {
        template_name: "call_declined",
        fields: { field_1: WAMPLI_BUSINESS_NAME },
        message_body: `We tried reaching you from ${WAMPLI_BUSINESS_NAME}. Reply CALLBACK to schedule a better time, or STOP to opt out.`,
      };
  }
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

  const { template_name, fields, message_body } = getTemplateConfig(options.type, options);
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
