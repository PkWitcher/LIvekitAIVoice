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
        daily: [],
        previousPeriod: { total: 0, completed: 0 },
      });
    }

    // Current period: last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Fetch current period data
    const { data, error } = await supabase
      .from("phone_logs")
      .select("status, duration_seconds, direction, created_at")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Fetch previous period for comparison
    const { data: prevData } = await supabase
      .from("phone_logs")
      .select("status, duration_seconds, direction, created_at")
      .eq("user_id", user.id)
      .gte("created_at", sixtyDaysAgo.toISOString())
      .lt("created_at", thirtyDaysAgo.toISOString());

    const total = data.length;
    const completed = data.filter((r) => r.status === "completed").length;
    const noAnswer = data.filter((r) => r.status === "no-answer").length;
    const ringing = data.filter(
      (r) => r.status === "ringing" || r.status === "connected"
    ).length;
    const outbound = data.filter((r) => r.direction === "outbound").length;
    const inbound = data.filter((r) => r.direction === "inbound").length;

    const durations = data
      .filter((r) => r.duration_seconds && r.duration_seconds > 0)
      .map((r) => r.duration_seconds as number);

    const avgDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    const pickupRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Previous period stats
    const prevTotal = prevData?.length ?? 0;
    const prevCompleted = prevData?.filter((r) => r.status === "completed").length ?? 0;
    const prevPickupRate = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0;

    // Build daily breakdown
    const dailyMap: Record<string, { date: string; total: number; completed: number; outbound: number; inbound: number }> = {};

    for (const row of data) {
      const date = new Date(row.created_at).toISOString().split("T")[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { date, total: 0, completed: 0, outbound: 0, inbound: 0 };
      }
      dailyMap[date].total++;
      if (row.status === "completed") dailyMap[date].completed++;
      if (row.direction === "outbound") dailyMap[date].outbound++;
      if (row.direction === "inbound") dailyMap[date].inbound++;
    }

    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      stats: { total, completed, noAnswer, ringing, avgDuration, outbound, inbound, pickupRate },
      daily,
      previousPeriod: { total: prevTotal, completed: prevCompleted, pickupRate: prevPickupRate },
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
