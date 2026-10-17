import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import { POSITIVE_DISPOSITIONS } from "@/lib/callDisposition";

const PERIOD_DAYS: Record<string, number> = {
  "7d": 7,
  "1m": 30,
  "6m": 180,
  "1y": 365,
};

const COST_PER_MINUTE = Number(process.env.CALL_COST_PER_MINUTE ?? "1.5");

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
        stats: { total: 0, completed: 0, noAnswer: 0, ringing: 0, avgDuration: 0, minutesUsed: 0, conversionRate: 0 },
        daily: [],
        previousPeriod: { total: 0, completed: 0 },
        dispositionBreakdown: {},
        agentBreakdown: [],
        campaignBreakdown: [],
        costAnalytics: { ratePerMinute: COST_PER_MINUTE, totalCost: 0, byAgent: [] },
      });
    }

    const period = request.nextUrl.searchParams.get("period") ?? "7d";
    const fromParam = request.nextUrl.searchParams.get("from");
    const toParam = request.nextUrl.searchParams.get("to");
    const isCustomRange = Boolean(fromParam && toParam);

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date | null = null; // exclusive upper bound — only set for a custom range
    let periodDays: number;

    if (isCustomRange) {
      periodStart = new Date(`${fromParam}T00:00:00.000Z`);
      const toDateInclusive = new Date(`${toParam}T00:00:00.000Z`);
      periodEnd = new Date(toDateInclusive.getTime() + 24 * 60 * 60 * 1000);
      periodDays = Math.min(366, Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000))));
    } else {
      periodDays = PERIOD_DAYS[period] ?? PERIOD_DAYS["7d"];
      periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    }
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
    let query = supabase
      .from("phone_logs")
      .select("status, duration_seconds, direction, created_at, disposition, agent_id, campaign_id")
      .eq("user_id", user.id)
      .gte("created_at", periodStart.toISOString());
    if (periodEnd) query = query.lt("created_at", periodEnd.toISOString());
    const { data, error } = await query;

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
      const date = isCustomRange
        ? new Date(periodStart.getTime() + index * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - (periodDays - 1 - index) * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split("T")[0];
      return dailyMap[dateKey] ?? { date: dateKey, total: 0, completed: 0, outbound: 0, inbound: 0 };
    });

    // ── Disposition breakdown + conversion rate (derived from AI-classified transcripts) ──
    const dispositionBreakdown: Record<string, number> = {};
    let convertedCount = 0;
    for (const row of data) {
      if (!row.disposition) continue;
      dispositionBreakdown[row.disposition] = (dispositionBreakdown[row.disposition] ?? 0) + 1;
      if (POSITIVE_DISPOSITIONS.includes(row.disposition)) convertedCount++;
    }
    const conversionRate = total > 0 ? Math.round((convertedCount / total) * 100) : 0;

    // ── Agent-wise breakdown ──
    const agentIds = Array.from(new Set(data.map((r) => r.agent_id).filter(Boolean))) as string[];
    let agentNames: Record<string, string> = {};
    if (agentIds.length > 0) {
      const { data: agentRows } = await supabase.from("agents").select("id, name").in("id", agentIds);
      agentNames = Object.fromEntries((agentRows ?? []).map((a) => [a.id, a.name]));
    }
    const agentStatsMap: Record<string, { total: number; completed: number; durationSum: number }> = {};
    for (const row of data) {
      if (!row.agent_id) continue;
      const bucket = agentStatsMap[row.agent_id] ?? { total: 0, completed: 0, durationSum: 0 };
      bucket.total++;
      if (row.status === "completed") {
        bucket.completed++;
        bucket.durationSum += Number(row.duration_seconds) || 0;
      }
      agentStatsMap[row.agent_id] = bucket;
    }
    const agentBreakdown = Object.entries(agentStatsMap)
      .map(([agentId, s]) => ({
        agent_id: agentId,
        agent_name: agentNames[agentId] ?? "Unknown Agent",
        total: s.total,
        completed: s.completed,
        pickupRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
        avgDuration: s.completed > 0 ? Math.round(s.durationSum / s.completed) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ── Campaign-wise breakdown (one campaign_id per /api/queue bulk batch) ──
    const campaignStatsMap: Record<string, { total: number; completed: number; firstSeen: string }> = {};
    for (const row of data) {
      if (!row.campaign_id) continue;
      const bucket = campaignStatsMap[row.campaign_id] ?? { total: 0, completed: 0, firstSeen: row.created_at };
      bucket.total++;
      if (row.status === "completed") bucket.completed++;
      if (row.created_at < bucket.firstSeen) bucket.firstSeen = row.created_at;
      campaignStatsMap[row.campaign_id] = bucket;
    }
    const campaignBreakdown = Object.entries(campaignStatsMap)
      .map(([campaignId, s]) => ({
        campaign_id: campaignId,
        started_at: s.firstSeen,
        total: s.total,
        completed: s.completed,
        pickupRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      }))
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    // ── Cost analytics (estimated from call minutes — set CALL_COST_PER_MINUTE to your real rate) ──
    const periodMinutes = durations.reduce((sum, d) => sum + d, 0) / 60;
    const costAnalytics = {
      ratePerMinute: COST_PER_MINUTE,
      totalCost: Math.round(periodMinutes * COST_PER_MINUTE * 100) / 100,
      byAgent: agentBreakdown.map((a) => ({
        agent_id: a.agent_id,
        agent_name: a.agent_name,
        cost: Math.round(((a.avgDuration * a.completed) / 60) * COST_PER_MINUTE * 100) / 100,
      })),
    };

    return NextResponse.json({
      success: true,
      stats: { total, completed, noAnswer, ringing, avgDuration, outbound, inbound, pickupRate, minutesUsed, conversionRate },
      daily,
      previousPeriod: { total: prevTotal, completed: prevCompleted, pickupRate: prevPickupRate },
      dispositionBreakdown,
      agentBreakdown,
      campaignBreakdown,
      costAnalytics,
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
