import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { RoomServiceClient } from "livekit-server-sdk";
import { getSupabase } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

// Vercel Pro supports up to 300s per function — without this the route falls back to the
// much lower default (15s), which the serialized-call loop below easily exceeds.
export const maxDuration = 300;

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "http://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";
// Calls are fully serialized (wait for each to finish before dialing the next) so a single
// worker (e.g. a laptop) never has to run multiple concurrent pipelines — a fixed stagger
// alone doesn't prevent overlap since calls run far longer than any reasonable delay.
const CALL_POLL_INTERVAL_MS = 2000;
const CALL_MAX_WAIT_MS = 60_000;
const MIN_GAP_MS = 2000;

function getLivekitWsUrl(url: string): string {
  if (url.startsWith("wss://") || url.startsWith("ws://")) return url;
  if (url.startsWith("https://")) return url.replace("https://", "wss://");
  if (url.startsWith("http://")) return url.replace("http://", "ws://");
  return url;
}

interface QueueBody {
  phone_numbers?: string[];
  contacts?: { phone: string; prompt?: string; first_message?: string; name?: string }[];
  prompt?: string;
  model_provider?: string;
  voice_id?: string;
  language?: string;
  agent_id?: string;
  tts_provider?: string;
  temperature?: number;
  first_message?: string;
  sheet_url?: string;
}

interface DialResult {
  phone: string;
  status: "dispatched" | "failed";
  room_name?: string;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll phone_logs until the call reaches a terminal status (or the max wait elapses). */
async function waitForCallToFinish(roomName: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    await sleep(MIN_GAP_MS);
    return;
  }
  const deadline = Date.now() + CALL_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(CALL_POLL_INTERVAL_MS);
    const { data } = await supabase
      .from("phone_logs")
      .select("status")
      .eq("room_name", roomName)
      .single();
    if (data && data.status !== "ringing" && data.status !== "connected") {
      return;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerSupabase();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Check subscription — user must have an active plan to make calls
    const supabase = getSupabase();
    const { data: subscription } = await supabase
      ?.from("user_subscriptions")
      .select("status, max_calls_per_month, calls_used")
      .eq("user_id", user.id)
      .single() ?? { data: null };

    if (!subscription || (subscription.status !== "active" && subscription.status !== "trial")) {
      return NextResponse.json(
        { success: false, error: "No active subscription. Please contact admin to activate your plan." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as QueueBody;

    // `contacts` (per-contact prompt/first_message, e.g. personalized {{name}}) takes priority;
    // falls back to the older flat phone_numbers + one shared prompt for compatibility.
    const normalizedContacts: { phone: string; prompt: string; first_message: string; name: string }[] =
      Array.isArray(body.contacts) && body.contacts.length > 0
        ? body.contacts.map((c) => ({
            phone: c.phone,
            prompt: c.prompt ?? body.prompt ?? "",
            first_message: c.first_message ?? body.first_message ?? "",
            name: c.name ?? "",
          }))
        : (body.phone_numbers ?? []).map((phone) => ({
            phone,
            prompt: body.prompt ?? "",
            first_message: body.first_message ?? "",
            name: "",
          }));

    if (normalizedContacts.length === 0) {
      return NextResponse.json(
        { success: false, error: "contacts or phone_numbers array is required" },
        { status: 400 }
      );
    }

    // Check if user has enough calls remaining
    const remainingCalls = subscription.max_calls_per_month - subscription.calls_used;
    if (normalizedContacts.length > remainingCalls) {
      return NextResponse.json(
        { success: false, error: `Only ${remainingCalls} calls remaining this month. Reduce numbers or upgrade plan.` },
        { status: 403 }
      );
    }

    if (normalizedContacts.length > 100) {
      return NextResponse.json(
        { success: false, error: "Maximum 100 numbers per batch" },
        { status: 400 }
      );
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return NextResponse.json(
        { success: false, error: "LiveKit credentials not configured" },
        { status: 500 }
      );
    }

    const wsUrl = getLivekitWsUrl(LIVEKIT_URL);
    const roomService = new RoomServiceClient(
      wsUrl,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    const campaignId = randomUUID();
    const results: DialResult[] = [];

    for (const contact of normalizedContacts) {
      let phone = contact.phone.trim();

      if (!/^\+?\d{7,15}$/.test(phone)) {
        results.push({
          phone,
          status: "failed",
          error: "Invalid format",
        });
        continue;
      }

      // Auto-add +91 for 10-digit Indian numbers without country code
      if (/^\d{10}$/.test(phone)) {
        phone = `+91${phone}`;
      } else if (!phone.startsWith("+")) {
        phone = `+${phone}`;
      }

      try {
        const roomName = `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const metadata = JSON.stringify({
          phone_number: phone,
          prompt: contact.prompt,
          model_provider: body.model_provider ?? "openai",
          voice_id: body.voice_id ?? "aura-asteria-en",
          language: body.language ?? "multi",
          tts_provider: body.tts_provider,
          temperature: body.temperature,
          first_message: contact.first_message,
          agent_id: body.agent_id,
        });

        await roomService.createRoom({
          name: roomName,
          emptyTimeout: 300,
          maxParticipants: 5,
        });

        // Explicitly set metadata after room creation (LiveKit Cloud requires this —
        // embedding it directly in createRoom() above isn't reliably applied).
        await roomService.updateRoomMetadata(roomName, metadata);

        // Do NOT create the SIP participant here — the agent handles dialing via
        // dial_outbound() when it joins and reads phone_number from metadata.
        results.push({ phone, status: "dispatched", room_name: roomName });

        // Log to Supabase — awaited so the row exists before we poll its status below
        await getSupabase()?.from("phone_logs").insert({
          user_id: user.id,
          phone_number: phone,
          direction: "outbound",
          status: "ringing",
          room_name: roomName,
          model_provider: body.model_provider ?? "groq",
          voice_id: body.voice_id ?? "aura-asteria-en",
          prompt: contact.prompt || null,
          agent_id: body.agent_id || null,
          campaign_id: campaignId,
          sheet_url: body.sheet_url || null,
          contact_name: contact.name || null,
        }).then();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        results.push({ phone, status: "failed", error: message });
        continue;
      }

      const lastRoomName = results[results.length - 1]?.room_name;
      if (lastRoomName) {
        await waitForCallToFinish(lastRoomName);
      } else {
        await sleep(MIN_GAP_MS);
      }
    }

    // Update calls_used count in subscription
    const dispatched = results.filter((r) => r.status === "dispatched").length;
    if (dispatched > 0) {
      await supabase
        ?.from("user_subscriptions")
        .update({ calls_used: subscription.calls_used + dispatched })
        .eq("user_id", user.id);
    }

    // Auto-save prompt to user's saved_prompts if not already saved
    const promptToSave = body.prompt ?? normalizedContacts[0]?.prompt ?? "";
    if (promptToSave.trim().length > 10 && dispatched > 0) {
      const promptText = promptToSave.trim();
      const { data: existing } = await supabase
        ?.from("saved_prompts")
        .select("id")
        .eq("user_id", user.id)
        .eq("prompt", promptText)
        .limit(1) ?? { data: null };

      if (!existing || existing.length === 0) {
        const firstLine = promptText.split('\n')[0].replace(/^#+\s*/, '').replace(/^Tu |^You are /i, '');
        const autoTitle = firstLine.length > 40 ? firstLine.substring(0, 40) + '...' : firstLine;
        await supabase?.from("saved_prompts").insert({
          user_id: user.id,
          title: autoTitle,
          prompt: promptText,
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: results.length,
      dispatched,
      failed: results.filter((r) => r.status === "failed").length,
      results,
      campaign_id: campaignId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Queue error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
