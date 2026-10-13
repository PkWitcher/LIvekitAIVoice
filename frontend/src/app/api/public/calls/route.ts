import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { getSupabase } from "@/lib/supabase";
import { hashApiKey } from "@/lib/apiKeys";
import { substituteVariables } from "@/lib/promptVariables";

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "http://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";

function getLivekitWsUrl(url: string): string {
  if (url.startsWith("wss://") || url.startsWith("ws://")) return url;
  if (url.startsWith("https://")) return url.replace("https://", "wss://");
  if (url.startsWith("http://")) return url.replace("http://", "ws://");
  return url;
}

// POST — public, API-key-authenticated trigger-call endpoint for n8n/Make/Zapier/Meta Lead
// Ads/custom integrations. Auth: `Authorization: Bearer <api_key>` (generated in dashboard
// Settings > Integrations). Body: { phone_number, agent_id?, variable_values?, prompt?, ... }
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing Authorization: Bearer <api_key> header" },
        { status: 401 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Server not configured" }, { status: 500 });
    }

    const { data: keyRow } = await supabase
      .from("api_keys")
      .select("id, user_id, revoked")
      .eq("key_hash", hashApiKey(apiKey))
      .single();

    if (!keyRow || keyRow.revoked) {
      return NextResponse.json({ success: false, error: "Invalid or revoked API key" }, { status: 401 });
    }

    supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id).then();
    const userId = keyRow.user_id;

    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("status, max_calls_per_month, calls_used")
      .eq("user_id", userId)
      .single();

    if (!subscription || (subscription.status !== "active" && subscription.status !== "trial")) {
      return NextResponse.json(
        { success: false, error: "No active subscription for this account" },
        { status: 403 }
      );
    }
    if (subscription.calls_used >= subscription.max_calls_per_month) {
      return NextResponse.json(
        { success: false, error: "Monthly call limit reached for this account" },
        { status: 403 }
      );
    }

    const body = await request.json();
    let phone = String(body.phone_number ?? "").trim();
    if (!/^\+?\d{7,15}$/.test(phone)) {
      return NextResponse.json({ success: false, error: "Invalid phone_number format" }, { status: 400 });
    }
    if (/^\d{10}$/.test(phone)) {
      phone = `+91${phone}`;
    } else if (!phone.startsWith("+")) {
      phone = `+${phone}`;
    }

    let prompt = body.prompt ?? "";
    let firstMessage = body.first_message ?? "";
    let voiceId = body.voice_id ?? "aura-asteria-en";
    let ttsProvider = body.tts_provider;
    let modelProvider = body.model_provider ?? "openai";
    let language = body.language ?? "multi";
    let temperature = body.temperature;
    let agentId: string | undefined = body.agent_id;

    if (agentId) {
      const { data: agent } = await supabase
        .from("agents")
        .select("group_id, system_prompt, first_message, voice_provider, voice_id, llm_provider, temperature, language")
        .eq("id", agentId)
        .eq("user_id", userId)
        .single();

      if (!agent) {
        return NextResponse.json({ success: false, error: "agent_id not found for this account" }, { status: 404 });
      }

      const values = body.variable_values ?? {};
      prompt = substituteVariables(agent.system_prompt, values);
      firstMessage = substituteVariables(agent.first_message, values);
      voiceId = agent.voice_id;
      ttsProvider = agent.voice_provider;
      modelProvider = agent.llm_provider;
      language = agent.language;
      temperature = agent.temperature;
      agentId = agent.group_id;
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return NextResponse.json({ success: false, error: "LiveKit credentials not configured" }, { status: 500 });
    }

    const roomName = `api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const metadata = JSON.stringify({
      phone_number: phone,
      prompt,
      model_provider: modelProvider,
      voice_id: voiceId,
      language,
      tts_provider: ttsProvider,
      temperature,
      first_message: firstMessage,
      agent_id: agentId,
    });

    const wsUrl = getLivekitWsUrl(LIVEKIT_URL);
    const roomService = new RoomServiceClient(wsUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    await roomService.createRoom({ name: roomName, emptyTimeout: 30, maxParticipants: 5 });
    await roomService.updateRoomMetadata(roomName, metadata);

    await supabase.from("phone_logs").insert({
      user_id: userId,
      phone_number: phone,
      direction: "outbound",
      status: "ringing",
      room_name: roomName,
      model_provider: modelProvider,
      voice_id: voiceId,
      prompt: prompt || null,
      agent_id: agentId || null,
    });

    await supabase
      .from("user_subscriptions")
      .update({ calls_used: subscription.calls_used + 1 })
      .eq("user_id", userId);

    return NextResponse.json({ success: true, room_name: roomName, phone_number: phone });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
