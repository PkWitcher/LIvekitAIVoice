import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({ success: true, subscriptions: [] });
    }

    const { data: subscriptions, error } = await supabase
      .from("user_subscriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Get user emails
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
    const emailMap: Record<string, string> = {};
    if (authUsers) {
      for (const u of authUsers) {
        emailMap[u.id] = u.email ?? "Unknown";
      }
    }

    const enriched = (subscriptions || []).map((sub) => ({
      ...sub,
      email: emailMap[sub.user_id] || "Unknown",
    }));

    return NextResponse.json({ success: true, subscriptions: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await createServerSupabase();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { user_id, plan, status, max_calls_per_month, max_minutes_per_month, amount_cents, expires_at } = body;

    if (!user_id || !plan) {
      return NextResponse.json({ success: false, error: "user_id and plan are required" }, { status: 400 });
    }

    const validPlans = ["free", "basic", "pro", "enterprise"];
    const validStatuses = ["active", "expired", "cancelled", "trial"];

    if (!validPlans.includes(plan)) {
      return NextResponse.json({ success: false, error: "Invalid plan" }, { status: 400 });
    }
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    // Upsert subscription
    const { data, error } = await supabase
      .from("user_subscriptions")
      .upsert(
        {
          user_id,
          plan,
          status: status || "active",
          max_calls_per_month: max_calls_per_month ?? 50,
          max_minutes_per_month: max_minutes_per_month ?? 100,
          amount_cents: amount_cents ?? 0,
          expires_at: expires_at || null,
          started_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, subscription: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabaseAuth = await createServerSupabase();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json({ success: false, error: "user_id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_subscriptions")
      .delete()
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
