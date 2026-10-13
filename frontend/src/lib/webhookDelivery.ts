// Outbound webhook delivery — HMAC-signed POSTs so customers can wire n8n/Make/Zapier/
// their own CRM to react to call events without any vendor-specific integration code.
import { createHmac } from "crypto";
import { getSupabase } from "@/lib/supabase";

const DELIVERY_TIMEOUT_MS = 8000;

export async function deliverWebhooks(
  userId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data: webhooks } = await supabase
    .from("webhooks")
    .select("id, url, secret")
    .eq("user_id", userId)
    .eq("is_active", true)
    .contains("events", [event]);

  if (!webhooks || webhooks.length === 0) return;

  const body = JSON.stringify({ event, ...payload });

  await Promise.all(
    webhooks.map(async (hook) => {
      const signature = createHmac("sha256", hook.secret).update(body).digest("hex");
      let statusCode: number | null = null;
      let success = false;
      let error: string | null = null;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
        const res = await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Nova-Event": event,
            "X-Nova-Signature": signature,
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        statusCode = res.status;
        success = res.ok;
      } catch (e) {
        error = e instanceof Error ? e.message : "Request failed";
      }

      await supabase.from("webhook_deliveries").insert({
        webhook_id: hook.id,
        event,
        status_code: statusCode,
        success,
        error,
      });
    })
  );
}
