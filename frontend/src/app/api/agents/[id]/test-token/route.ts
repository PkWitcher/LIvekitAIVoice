import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient, AccessToken } from "livekit-server-sdk";
import { createServerSupabase } from "@/lib/supabase-server";

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "http://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";

function getLivekitWsUrl(url: string): string {
  if (url.startsWith("wss://") || url.startsWith("ws://")) return url;
  if (url.startsWith("https://")) return url.replace("https://", "wss://");
  if (url.startsWith("http://")) return url.replace("http://", "ws://");
  return url;
}

function substituteVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
    key in values && values[key].trim() ? values[key] : match
  );
}

// POST — mint a browser join token + room so the Agent Builder's "Test in Browser"
// widget can talk to the saved agent directly, without dialing a real phone number.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return NextResponse.json(
        { success: false, error: "LiveKit credentials not configured" },
        { status: 500 }
      );
    }

    const { data: agent, error } = await supabase
      .from("agents")
      .select("id, group_id, name, language, voice_provider, voice_id, llm_provider, temperature, first_message, system_prompt")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !agent) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const variableValues = (await request.json().catch(() => ({})))?.variable_values ?? {};
    const prompt = substituteVariables(agent.system_prompt, variableValues);
    const firstMessage = substituteVariables(agent.first_message, variableValues);

    const roomName = `test-${agent.id.slice(0, 8)}-${Date.now()}`;
    const metadata = JSON.stringify({
      prompt,
      first_message: firstMessage,
      model_provider: agent.llm_provider,
      tts_provider: agent.voice_provider,
      voice_id: agent.voice_id,
      language: agent.language,
      temperature: agent.temperature,
      agent_id: agent.group_id,
    });

    const wsUrl = getLivekitWsUrl(LIVEKIT_URL);
    const roomService = new RoomServiceClient(wsUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    await roomService.createRoom({ name: roomName, emptyTimeout: 300, maxParticipants: 2 });
    await roomService.updateRoomMetadata(roomName, metadata);

    const identity = `web-tester-${user.id.slice(0, 8)}`;
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: "Test Caller",
      ttl: "15m",
    });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    return NextResponse.json({
      success: true,
      url: wsUrl,
      token: await token.toJwt(),
      room_name: roomName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
