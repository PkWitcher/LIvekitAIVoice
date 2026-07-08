import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

const ADMIN_EMAIL = "admin@gmail.com";

export async function GET() {
  try {
    const supabaseAuth = await createServerSupabase();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({
        success: true,
        stats: { total_users: 0, total_calls: 0, total_minutes: 0, users: [] },
      });
    }

    // Get all phone logs with user_id
    const { data: logs, error } = await supabase
      .from("phone_logs")
      .select("user_id, status, duration_seconds, created_at")
      .not("user_id", "is", null);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Get user emails from auth.users via admin API
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();

    const emailMap: Record<string, string> = {};
    if (authUsers) {
      for (const u of authUsers) {
        emailMap[u.id] = u.email ?? "Unknown";
      }
    }

    // Get user profiles (name, phone)
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, phone, created_at");

    const profileMap: Record<string, { full_name: string; phone: string; registered_at: string }> = {};
    if (profiles) {
      for (const p of profiles) {
        profileMap[p.id] = { full_name: p.full_name || "", phone: p.phone || "", registered_at: p.created_at };
      }
    }

    // Aggregate per user
    const userMap: Record<string, {
      user_id: string;
      email: string;
      full_name: string;
      phone: string;
      registered_at: string | null;
      total_calls: number;
      completed_calls: number;
      failed_calls: number;
      no_answer_calls: number;
      total_duration_seconds: number;
      durations: number[];
      last_call_at: string | null;
    }> = {};

    for (const log of logs || []) {
      const uid = log.user_id;
      if (!userMap[uid]) {
        const profile = profileMap[uid];
        userMap[uid] = {
          user_id: uid,
          email: emailMap[uid] || "Unknown",
          full_name: profile?.full_name || "",
          phone: profile?.phone || "",
          registered_at: profile?.registered_at || null,
          total_calls: 0,
          completed_calls: 0,
          failed_calls: 0,
          no_answer_calls: 0,
          total_duration_seconds: 0,
          durations: [],
          last_call_at: null,
        };
      }

      const entry = userMap[uid];
      entry.total_calls++;

      if (log.status === "completed") entry.completed_calls++;
      if (log.status === "failed") entry.failed_calls++;
      if (log.status === "no-answer") entry.no_answer_calls++;

      if (log.duration_seconds && log.duration_seconds > 0) {
        entry.total_duration_seconds += log.duration_seconds;
        entry.durations.push(log.duration_seconds);
      }

      if (!entry.last_call_at || log.created_at > entry.last_call_at) {
        entry.last_call_at = log.created_at;
      }
    }

    const users = Object.values(userMap).map((u) => ({
      user_id: u.user_id,
      email: u.email,
      full_name: u.full_name,
      phone: u.phone,
      registered_at: u.registered_at,
      total_calls: u.total_calls,
      completed_calls: u.completed_calls,
      failed_calls: u.failed_calls,
      no_answer_calls: u.no_answer_calls,
      total_duration_seconds: u.total_duration_seconds,
      avg_duration_seconds: u.durations.length > 0
        ? u.total_duration_seconds / u.durations.length
        : 0,
      last_call_at: u.last_call_at,
    }));

    // Include all auth users, even those with 0 calls
    if (authUsers) {
      for (const u of authUsers) {
        if (!userMap[u.id]) {
          const profile = profileMap[u.id];
          users.push({
            user_id: u.id,
            email: u.email ?? "Unknown",
            full_name: profile?.full_name || u.user_metadata?.full_name || "",
            phone: profile?.phone || u.user_metadata?.phone || "",
            registered_at: profile?.registered_at || u.created_at || null,
            total_calls: 0,
            completed_calls: 0,
            failed_calls: 0,
            no_answer_calls: 0,
            total_duration_seconds: 0,
            avg_duration_seconds: 0,
            last_call_at: null,
          });
        }
      }
    }

    // Sort by total calls descending
    users.sort((a, b) => b.total_calls - a.total_calls);

    const totalMinutes = users.reduce((sum, u) => sum + u.total_duration_seconds, 0) / 60;

    return NextResponse.json({
      success: true,
      stats: {
        total_users: authUsers?.length ?? users.length,
        total_calls: logs?.length ?? 0,
        total_minutes: totalMinutes,
        users,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
