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

    console.log("Webhook event:", event.event, "room:", event.room?.name, "participant:", event.participant?.identity, "kind:", event.participant?.kind);

    // Detect SIP/phone participant: identity starts with phone-/sip-, OR kind is SIP
    const participantId = event.participant?.identity ?? "";
    const isPhoneParticipant =
      participantId.startsWith("phone-") ||
      participantId.startsWith("sip_") ||
      (event.participant as Record<string, unknown>)?.kind === 2; // SIP participant kind

    // ── Phone participant joined OR published audio = call was ANSWERED ──
    if (
      (event.event === "participant_joined" || event.event === "track_published") &&
      event.room?.name &&
      isPhoneParticipant
    ) {
      const roomName = event.room.name;

      if (supabase) {
        // Only update if still ringing (avoid double-update from both events)
        const { data } = await supabase
          .from("phone_logs")
          .update({
            status: "connected",
            connected_at: new Date().toISOString(),
          })
          .eq("room_name", roomName)
          .eq("status", "ringing")
          .select("id");

        // Start recording only on first transition to connected
        if (data && data.length > 0) {
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
      }
    }

    // ── Phone participant left ──
    if (
      event.event === "participant_left" &&
      event.room?.name &&
      isPhoneParticipant
    ) {
      if (supabase) {
        const roomName = event.room.name;
        const now = new Date().toISOString();

        // Check if the call was connected
        const { data: record } = await supabase
          .from("phone_logs")
          .select("status, connected_at")
          .eq("room_name", roomName)
          .single();

        if (record) {
          if (record.status === "connected" && record.connected_at) {
            // Call was answered then hung up — mark completed
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
          } else if (record.status === "ringing") {
            // Never answered — rejected/timeout
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

    // ── Room finished — fallback finalization ──
    if (event.event === "room_finished" && event.room?.name) {
      if (supabase) {
        const roomName = event.room.name;
        const now = new Date().toISOString();

        const { data: record } = await supabase
          .from("phone_logs")
          .select("status, connected_at")
          .eq("room_name", roomName)
          .single();

        if (record) {
          if (record.status === "connected" && record.connected_at) {
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
          } else if (record.status === "ringing") {
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
