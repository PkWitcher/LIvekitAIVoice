import { NextRequest, NextResponse } from "next/server";
import {
  WebhookReceiver,
  EgressClient,
  EncodedFileOutput,
} from "livekit-server-sdk";
import { getSupabase } from "@/lib/supabase";

const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "http://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";

const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const authHeader = request.headers.get("authorization") ?? "";
    const event = await receiver.receive(body, authHeader);
    const supabase = getSupabase();

    console.log("Webhook event:", event.event, event.room?.name, event.participant?.identity);

    // ── Phone participant answered the call ──
    if (
      event.event === "participant_joined" &&
      event.room?.name &&
      event.participant?.identity?.startsWith("phone-")
    ) {
      const roomName = event.room.name;

      // Mark call as connected with timestamp
      if (supabase) {
        await supabase
          .from("phone_logs")
          .update({
            status: "connected",
            connected_at: new Date().toISOString(),
          })
          .eq("room_name", roomName);
      }

      // Start recording only for answered calls
      try {
        const egressClient = new EgressClient(
          LIVEKIT_URL,
          LIVEKIT_API_KEY,
          LIVEKIT_API_SECRET
        );
        const output = new EncodedFileOutput({
          fileType: 2, // OGG
          filepath: `${roomName}.ogg`,
        });
        await egressClient.startRoomCompositeEgress(
          roomName,
          output,
          undefined,
          undefined,
          true // audioOnly
        );
      } catch (recErr) {
        console.warn("Recording start failed:", recErr);
      }
    }

    // ── Room finished — finalize call status & duration ──
    if (event.event === "room_finished" && event.room?.name) {
      if (supabase) {
        const roomName = event.room.name;
        const now = new Date().toISOString();

        // Get current call record to check if it was ever connected
        const { data: record } = await supabase
          .from("phone_logs")
          .select("status, connected_at")
          .eq("room_name", roomName)
          .single();

        if (record) {
          if (record.status === "connected" && record.connected_at) {
            // Call was answered — mark completed with actual talk duration
            const durationSeconds = Math.round(
              (Date.now() - new Date(record.connected_at).getTime()) / 1000
            );
            await supabase
              .from("phone_logs")
              .update({
                status: "completed",
                duration_seconds: durationSeconds,
                ended_at: now,
                recording_url: `/api/recordings/${roomName}.ogg`,
              })
              .eq("room_name", roomName);
          } else {
            // Call was never answered
            await supabase
              .from("phone_logs")
              .update({
                status: "no-answer",
                ended_at: now,
              })
              .eq("room_name", roomName);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
