import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { getSupabase } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

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
    const supabaseAuth = await createServerSupabase();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Check subscription — user must have an active plan to make calls
    const supabase = getSupabase();
    const { data: subscription } = await supabase
      ?.from("user_subscriptions")
      .select("status, max_calls_per_month, calls_used, max_minutes_per_month, minutes_used")
      .eq("user_id", user.id)
      .single() ?? { data: null };

    if (!subscription || (subscription.status !== "active" && subscription.status !== "trial")) {
      return NextResponse.json(
        { success: false, error: "No active subscription. Please contact admin to activate your plan." },
        { status: 403 }
      );
    }

    if (subscription.calls_used >= subscription.max_calls_per_month) {
      return NextResponse.json(
        { success: false, error: "Monthly call limit reached. Please upgrade your plan." },
        { status: 403 }
      );
    }

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
      model_provider: body.model_provider ?? "openai",
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
    await supabase?.from("phone_logs").insert({
      user_id: user.id,
      phone_number: phone,
      direction: "outbound",
      status: "ringing",
      room_name: roomName,
      model_provider: body.model_provider ?? "openai",
      voice_id: body.voice_id ?? "aura-asteria-en",
      prompt: body.prompt || null,
    });

    // Increment calls_used in subscription
    await supabase
      ?.from("user_subscriptions")
      .update({ calls_used: subscription.calls_used + 1 })
      .eq("user_id", user.id);

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
