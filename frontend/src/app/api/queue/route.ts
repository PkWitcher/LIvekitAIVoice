import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient, SipClient } from "livekit-server-sdk";

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "http://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";
const DIAL_DELAY_MS = 200;

interface QueueBody {
  phone_numbers: string[];
  prompt?: string;
  model_provider?: string;
  voice_id?: string;
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QueueBody;

    if (
      !Array.isArray(body.phone_numbers) ||
      body.phone_numbers.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "phone_numbers array is required" },
        { status: 400 }
      );
    }

    if (body.phone_numbers.length > 100) {
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

    const roomService = new RoomServiceClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    const sipClient = new SipClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    // Always auto-discover trunk (setup_sip_trunk.py recreates it on every startup)
    const trunks = await sipClient.listSipOutboundTrunk();
    const trunkId = trunks.length > 0 ? trunks[0].sipTrunkId : null;

    const results: DialResult[] = [];

    for (const raw of body.phone_numbers) {
      let phone = raw.trim();

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
          prompt: body.prompt ?? "",
          model_provider: body.model_provider ?? "groq",
          voice_id: body.voice_id ?? "aura-asteria-en",
        });

        await roomService.createRoom({
          name: roomName,
          metadata,
          emptyTimeout: 300,
          maxParticipants: 5,
        });

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

        results.push({ phone, status: "dispatched", room_name: roomName });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        results.push({ phone, status: "failed", error: message });
      }

      await sleep(DIAL_DELAY_MS);
    }

    return NextResponse.json({
      success: true,
      total: results.length,
      dispatched: results.filter((r) => r.status === "dispatched").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
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
