import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient, SipClient } from "livekit-server-sdk";

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "http://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";
const SIP_TRUNK_ID = process.env.VOBIZ_SIP_TRUNK_ID ?? "";

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

    const phone = body.phone_number.trim();

    if (!/^\+?\d{7,15}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number format" },
        { status: 400 }
      );
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
      voice_id: body.voice_id ?? "alloy",
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
    if (SIP_TRUNK_ID) {
      const sipClient = new SipClient(
        LIVEKIT_URL,
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
      );

      await sipClient.createSipParticipant(
        SIP_TRUNK_ID,
        phone,
        roomName,
        `phone-${phone}`,
        `Caller ${phone}`
      );
    }

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
