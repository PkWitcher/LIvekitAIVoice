import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabaseAuth = await createServerSupabase();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({
        success: true,
        stats: { total: 0, completed: 0, noAnswer: 0, ringing: 0, avgDuration: 0 },
      });
    }

    const { data, error } = await supabase
      .from("phone_logs")
      .select("status, duration_seconds")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const total = data.length;
    const completed = data.filter((r) => r.status === "completed").length;
    const noAnswer = data.filter((r) => r.status === "no-answer").length;
    const ringing = data.filter(
      (r) => r.status === "ringing" || r.status === "connected"
    ).length;

    const durations = data
      .filter((r) => r.duration_seconds && r.duration_seconds > 0)
      .map((r) => r.duration_seconds as number);

    const avgDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    return NextResponse.json({
      success: true,
      stats: { total, completed, noAnswer, ringing, avgDuration },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
