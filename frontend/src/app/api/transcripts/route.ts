import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabaseAuth = await createServerSupabase();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, calls: [] });
    }

    // Get user's completed calls that have transcripts
    const { data: calls } = await supabase
      .from("phone_logs")
      .select("room_name, phone_number, status, duration_seconds, created_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("room_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!calls || calls.length === 0) {
      return NextResponse.json({ success: true, calls: [] });
    }

    // Get transcript counts per room
    const roomNames = calls.map((c) => c.room_name).filter(Boolean);
    const { data: transcriptCounts } = await supabase
      .from("call_transcripts")
      .select("room_name")
      .in("room_name", roomNames);

    // Count messages per room
    const countMap: Record<string, number> = {};
    if (transcriptCounts) {
      for (const t of transcriptCounts) {
        countMap[t.room_name] = (countMap[t.room_name] || 0) + 1;
      }
    }

    // Only return calls that have at least 1 transcript message
    const callsWithTranscripts = calls
      .filter((c) => c.room_name && countMap[c.room_name] > 0)
      .map((c) => ({
        room_name: c.room_name,
        phone_number: c.phone_number,
        status: c.status,
        duration_seconds: c.duration_seconds,
        created_at: c.created_at,
        message_count: countMap[c.room_name] || 0,
      }));

    return NextResponse.json({ success: true, calls: callsWithTranscripts });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
