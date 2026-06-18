import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { getSupabase } from "@/lib/supabase";

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY ?? "",
  process.env.LIVEKIT_API_SECRET ?? ""
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const authHeader = request.headers.get("authorization") ?? "";

    const event = await receiver.receive(body, authHeader);

    // When a room finishes, update the call log
    if (event.event === "room_finished" && event.room?.name) {
      const supabase = getSupabase();
      if (!supabase) {
        return NextResponse.json({ ok: true });
      }

      const roomName = event.room.name;
      const createdAt = event.room.creationTime
        ? new Date(Number(event.room.creationTime) * 1000).toISOString()
        : null;

      // Calculate duration
      let durationSeconds: number | null = null;
      if (createdAt) {
        durationSeconds = Math.round(
          (Date.now() - new Date(createdAt).getTime()) / 1000
        );
      }

      await supabase
        .from("phone_logs")
        .update({
          status: "completed",
          duration_seconds: durationSeconds,
          ended_at: new Date().toISOString(),
        })
        .eq("room_name", roomName);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    // Return 200 so LiveKit doesn't retry
    return NextResponse.json({ ok: true });
  }
}
