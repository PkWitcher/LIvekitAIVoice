import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient, SipClient, EgressClient } from "livekit-server-sdk";
import { getSupabase } from "@/lib/supabase";

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "http://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";
interface DispatchBody {
  phone_number: string;
  prompt?: string;
  model_provider?: string;
  voice_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DispatchBody;

    if (!body.phone_number || typeof body.phone_number !== "string") {
      return NextResponse.json(
        { success: false, error: "phone_number is required" },
        { status: 400 }
      );
    }

    let phone = body.phone_number.trim();

    if (!/^\+?\d{7,15}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    // Auto-add +91 for 10-digit Indian numbers without country code
    if (/^\d{10}$/.test(phone)) {
      phone = `+91${phone}`;
    } else if (!phone.startsWith("+")) {
      phone = `+${phone}`;
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return NextResponse.json(
        { success: false, error: "LiveKit credentials not configured" },
        { status: 500 }
      );
    }

    const roomName = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const metadata = JSON.stringify({
      phone_number: phone,
      prompt: body.prompt ?? "",
      model_provider: body.model_provider ?? "groq",
      voice_id: body.voice_id ?? "aura-asteria-en",
    });

    // Create the room with metadata
    const roomService = new RoomServiceClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    await roomService.createRoom({
      name: roomName,
      metadata,
      emptyTimeout: 300,
      maxParticipants: 5,
    });

    // Create SIP participant to dial the phone number
    const sipClient = new SipClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    // Always auto-discover trunk (setup_sip_trunk.py recreates it on every startup)
    const trunks = await sipClient.listSipOutboundTrunk();
    const trunkId = trunks.length > 0 ? trunks[0].sipTrunkId : null;

    if (trunkId) {
      await sipClient.createSipParticipant(
        trunkId,
        phone,
        roomName,
        {
          participantIdentity: `phone-${phone}`,
          participantName: `Caller ${phone}`,
        }
      );
    }

    // Start audio recording
    try {
      const egressClient = new EgressClient(
        LIVEKIT_URL,
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
      );
      await egressClient.startRoomCompositeEgress(roomName, {
        file: {
          fileType: 0, // OGG
          filepath: `/recordings/${roomName}.ogg`,
        },
      }, { audioOnly: true });
    } catch (recErr) {
      console.warn("Recording start failed:", recErr);
    }

    // Log call to Supabase
    getSupabase()?.from("phone_logs").insert({
      phone_number: phone,
      direction: "outbound",
      status: "initiated",
      room_name: roomName,
      model_provider: body.model_provider ?? "groq",
      voice_id: body.voice_id ?? "aura-asteria-en",
      prompt: body.prompt || null,
      recording_url: `/recordings/${roomName}.ogg`,
    }).then();

    return NextResponse.json({
      success: true,
      room_name: roomName,
      phone_number: phone,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Dispatch error:", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
