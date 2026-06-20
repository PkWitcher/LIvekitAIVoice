import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { getSupabase } from "@/lib/supabase";

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "http://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";
interface DispatchBody {
  phone_number: string;
  prompt?: string;
  model_provider?: string;
  voice_id?: string;
  language?: string;
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
      language: body.language ?? "multi",
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
      emptyTimeout: 30,
      maxParticipants: 5,
    });

    // Log call to Supabase first — the agent will handle SIP dialing
    // via dial_outbound() when it joins the room and reads metadata.
    // Do NOT create SIP participant here to avoid double-dialing race conditions.
    await getSupabase()?.from("phone_logs").insert({
      phone_number: phone,
      direction: "outbound",
      status: "ringing",
      room_name: roomName,
      model_provider: body.model_provider ?? "groq",
      voice_id: body.voice_id ?? "aura-asteria-en",
      prompt: body.prompt || null,
    });

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
