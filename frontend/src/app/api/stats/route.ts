import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

const PERIOD_DAYS: Record<string, number> = {
  "7d": 7,
  "1m": 30,
  "6m": 180,
  "1y": 365,
};

export async function GET(request: NextRequest) {
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
        stats: { total: 0, completed: 0, noAnswer: 0, ringing: 0, avgDuration: 0, minutesUsed: 0 },
        daily: [],
        previousPeriod: { total: 0, completed: 0 },
      });
    }

    const period = request.nextUrl.searchParams.get("period") ?? "7d";
    const periodDays = PERIOD_DAYS[period] ?? PERIOD_DAYS["7d"];

    // Current period: selected chart range
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("started_at")
      .eq("user_id", user.id)
      .single();

    const usageStart = subscription?.started_at ?? new Date(0).toISOString();
    const { data: usageCalls, error: usageError } = await supabase
      .from("phone_logs")
      .select("duration_seconds")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("created_at", usageStart);

    if (usageError) {
      return NextResponse.json({ success: false, error: usageError.message }, { status: 500 });
    }

    const minutesUsed = (usageCalls ?? []).reduce(
      (total, call) => total + (Number(call.duration_seconds) || 0) / 60,
      0
    );

    // Fetch current period data
    const { data, error } = await supabase
      .from("phone_logs")
      .select("status, duration_seconds, direction, created_at")
      .eq("user_id", user.id)
      .gte("created_at", periodStart.toISOString());

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
      .gte("created_at", previousPeriodStart.toISOString())
      .lt("created_at", periodStart.toISOString());

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

    const daily = Array.from({ length: periodDays }, (_, index) => {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - (periodDays - 1 - index));
      const dateKey = date.toISOString().split("T")[0];
      return dailyMap[dateKey] ?? { date: dateKey, total: 0, completed: 0, outbound: 0, inbound: 0 };
    });

    return NextResponse.json({
      success: true,
      stats: { total, completed, noAnswer, ringing, avgDuration, outbound, inbound, pickupRate, minutesUsed },
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
