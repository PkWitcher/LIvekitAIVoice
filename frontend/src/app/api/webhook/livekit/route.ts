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

// Track active egress IDs per room so we can stop them
const activeEgress = new Map<string, string>();

let receiver: WebhookReceiver | null = null;
try {
  if (LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
    receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  }
} catch (e) {
  console.error("Failed to create WebhookReceiver:", e);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const authHeader = request.headers.get("authorization") ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;

  // Try validated first, fall back to raw parse if receiver fails
  if (receiver) {
    try {
      event = await receiver.receive(body, authHeader);
    } catch (err) {
      console.error("Webhook validation failed, parsing raw body:", err);
      try {
        event = JSON.parse(body);
      } catch {
        console.error("Failed to parse webhook body");
        return NextResponse.json({ ok: true });
      }
    }
  } else {
    try {
      event = JSON.parse(body);
    } catch {
      return NextResponse.json({ ok: true });
    }
  }

  const supabase = getSupabase();
  const eventType = event.event;
  const roomName = event.room?.name;
  const participantId = event.participant?.identity ?? "";

  console.log(`[WEBHOOK] event=${eventType} room=${roomName} participant=${participantId} numParticipants=${event.room?.numParticipants}`);

  if (!roomName || !supabase) {
    return NextResponse.json({ ok: true });
  }

  // Is this a phone/SIP participant? (positive match is safer than exclusion)
  const isPhoneParticipant = participantId.startsWith("phone-") || participantId.startsWith("sip_") || /^\+\d/.test(participantId);
  const isAgent = !isPhoneParticipant;

  try {
    // ── ANY non-agent participant joined = CALL ANSWERED ──
    if (eventType === "participant_joined" && !isAgent) {
      console.log(`[WEBHOOK] Phone participant joined: "${participantId}" in room ${roomName} — marking connected`);

      const { data, error } = await supabase
        .from("phone_logs")
        .update({
          status: "connected",
          connected_at: new Date().toISOString(),
        })
        .eq("room_name", roomName)
        .in("status", ["ringing", "no-answer"])
        .select("id");

      if (error) {
        console.error("[WEBHOOK] Supabase update error:", error);
      }

      console.log(`[WEBHOOK] Connected update result: ${JSON.stringify(data)}`);

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
            filepath: `/recordings/${roomName}.ogg`,
          });
          const egressInfo = await egressClient.startRoomCompositeEgress(
            roomName,
            output,
            undefined,
            undefined,
            true // audioOnly
          );
          // Store egress ID so we can stop it later
          if (egressInfo?.egressId) {
            activeEgress.set(roomName, egressInfo.egressId);
            console.log(`[WEBHOOK] Recording started for ${roomName}, egressId=${egressInfo.egressId}`);
          } else {
            console.log(`[WEBHOOK] Recording started for ${roomName} (no egressId returned)`);
          }
        } catch (recErr) {
          console.warn("[WEBHOOK] Recording start failed:", recErr);
        }
      }
    }

    // ── Non-agent participant left ──
    if (eventType === "participant_left" && !isAgent) {
      console.log(`[WEBHOOK] Non-agent participant left: "${participantId}" in room ${roomName}`);

      // Stop recording egress so the file is finalized
      await stopEgress(roomName);

      const { data: record } = await supabase
        .from("phone_logs")
        .select("status, connected_at, created_at")
        .eq("room_name", roomName)
        .single();

      console.log(`[WEBHOOK] Current record status: ${record?.status}, connected_at: ${record?.connected_at}`);

      if (record) {
        const now = new Date().toISOString();

        if (record.status === "connected" || record.status === "ringing") {
          // Calculate duration from connected_at, or fallback to created_at
          const startTime = record.connected_at || record.created_at;
          const durationSeconds = startTime
            ? Math.round((Date.now() - new Date(startTime).getTime()) / 1000)
            : 0;
          
          console.log(`[WEBHOOK] Marking completed, duration=${durationSeconds}s (from ${record.connected_at ? 'connected_at' : 'created_at'})`);
          await supabase
            .from("phone_logs")
            .update({
              status: "completed",
              duration_seconds: durationSeconds,
              ended_at: now,
              recording_url: `/api/recordings/${roomName}.ogg`,
            })
            .eq("room_name", roomName);
        }
      }
    }

    // ── Room finished — fallback ──
    if (eventType === "room_finished") {
      // Stop egress in case it wasn't stopped by participant_left
      await stopEgress(roomName);

      const { data: record } = await supabase
        .from("phone_logs")
        .select("status, connected_at, created_at")
        .eq("room_name", roomName)
        .single();

      console.log(`[WEBHOOK] Room finished. Record status: ${record?.status}`);

      if (record) {
        const now = new Date().toISOString();

        if ((record.status === "connected" || record.status === "ringing") && record.connected_at) {
          const startTime = record.connected_at || record.created_at;
          const durationSeconds = startTime
            ? Math.round((Date.now() - new Date(startTime).getTime()) / 1000)
            : 0;
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
  } catch (err) {
    console.error("[WEBHOOK] Processing error:", err);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Stop an active egress recording so the file is finalized and playable.
 */
async function stopEgress(roomName: string): Promise<void> {
  const egressId = activeEgress.get(roomName);
  if (!egressId) {
    console.log(`[WEBHOOK] No active egress to stop for ${roomName}`);
    return;
  }

  try {
    const egressClient = new EgressClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );
    await egressClient.stopEgress(egressId);
    console.log(`[WEBHOOK] Egress stopped for ${roomName}, egressId=${egressId}`);
  } catch (err) {
    // Egress may already be stopped if room ended naturally
    console.warn(`[WEBHOOK] Failed to stop egress for ${roomName}:`, err);
  } finally {
    activeEgress.delete(roomName);
  }
}
