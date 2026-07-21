/**
 * WhatsApp Integration via AiSensy
 *
 * Sends WhatsApp messages using AiSensy's API.
 *
 * Required env vars:
 *   AISENSY_API_KEY    — API key from AiSensy dashboard (Settings → API & Webhook)
 *   WHATSAPP_ENABLED   — Set to "true" to enable (disabled by default)
 *
 * You must create these 3 templates in AiSensy dashboard (Templates → Create):
 *   call_completed  — "Thank you for speaking with us. Your call lasted {{1}} minutes."
 *   call_missed     — "We tried reaching you but couldn't connect. Reply CALLBACK for a callback."
 *   call_rejected   — "We attempted to reach you. Reply CALLBACK or STOP to opt out."
 */

const AISENSY_API_KEY = process.env.AISENSY_API_KEY ?? "";
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";

const AISENSY_API_URL = "https://backend.aisensy.com/campaign/t1/api/v2";

export type WhatsAppMessageType = "call_completed" | "call_missed" | "call_rejected";

interface SendMessageOptions {
  to: string; // Phone number (e.g. +919876543210 or 9876543210)
  type: WhatsAppMessageType;
  callDuration?: number; // seconds
  userName?: string;
}

/**
 * Format phone number — ensure 91 prefix, digits only
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
 * Get AiSensy campaign/template name and params for each event type
 */
function getCampaignConfig(type: WhatsAppMessageType, options: SendMessageOptions) {
  switch (type) {
    case "call_completed": {
      const mins = options.callDuration ? Math.ceil(options.callDuration / 60) : 0;
      return {
        campaignName: "call_completed",
        templateParams: [String(mins)],
      };
    }
    case "call_missed":
      return {
        campaignName: "call_missed",
        templateParams: [],
      };
    case "call_rejected":
      return {
        campaignName: "call_rejected",
        templateParams: [],
      };
  }
}

/**
 * Send a WhatsApp message via AiSensy
 */
export async function sendWhatsAppMessage(options: SendMessageOptions): Promise<boolean> {
  if (!WHATSAPP_ENABLED) {
    console.log(`[WHATSAPP] Disabled — skipping message to ${options.to} (${options.type})`);
    return false;
  }

  if (!AISENSY_API_KEY) {
    console.warn("[WHATSAPP] Missing AISENSY_API_KEY");
    return false;
  }

  const to = formatPhone(options.to);
  if (!to || to.length < 12) {
    console.warn(`[WHATSAPP] Invalid phone number: ${options.to}`);
    return false;
  }

  const { campaignName, templateParams } = getCampaignConfig(options.type, options);

  try {
    const res = await fetch(AISENSY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: AISENSY_API_KEY,
        campaignName,
        destination: to,
        userName: options.userName || "Customer",
        templateParams,
        source: "nova-ai-voice",
      }),
    });

    const data = await res.json();

    if (res.ok && data.status !== "error") {
      console.log(`[WHATSAPP] AiSensy message sent to ${to} (${options.type})`);
      return true;
    } else {
      console.error(`[WHATSAPP] AiSensy error for ${to}: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    console.error("[WHATSAPP] Network error:", err);
    return false;
  }
}
