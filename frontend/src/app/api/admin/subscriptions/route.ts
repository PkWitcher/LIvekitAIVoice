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

    // Get user emails/names (listUsers is paginated; default page size is 50)
    const userMap: Record<string, { email: string; full_name: string }> = {};
    for (let page = 1; page <= 20; page++) {
      const { data: pageData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (listError || !pageData?.users?.length) break;
      for (const u of pageData.users) {
        const fullName = u.user_metadata?.full_name;
        userMap[u.id] = {
          email: u.email ?? "Unknown",
          full_name: typeof fullName === "string" ? fullName : "",
        };
      }
      if (pageData.users.length < 1000) break;
    }

    const enriched = (subscriptions || []).map((sub) => ({
      ...sub,
      email: userMap[sub.user_id]?.email || "Unknown",
      full_name: userMap[sub.user_id]?.full_name || "",
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
    const {
      user_id, plan, status, max_calls_per_month, max_minutes_per_month,
      amount_cents, expires_at, currency, reset_usage,
    } = body;

    if (!user_id || !plan) {
      return NextResponse.json({ success: false, error: "user_id and plan are required" }, { status: 400 });
    }

    const validPlans = ["free", "basic", "pro", "enterprise"];
    const validStatuses = ["active", "expired", "cancelled", "trial"];
    const validCurrencies = ["INR", "USD"];

    if (!validPlans.includes(plan)) {
      return NextResponse.json({ success: false, error: "Invalid plan" }, { status: 400 });
    }
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }
    if (currency && !validCurrencies.includes(currency)) {
      return NextResponse.json({ success: false, error: "Invalid currency" }, { status: 400 });
    }

    const limits = {
      max_calls_per_month: max_calls_per_month ?? 50,
      max_minutes_per_month: max_minutes_per_month ?? 100,
      amount_cents: amount_cents ?? 0,
    };
    for (const [field, value] of Object.entries(limits)) {
      if (!Number.isInteger(value) || value < 0) {
        return NextResponse.json({ success: false, error: `${field} must be a non-negative whole number` }, { status: 400 });
      }
    }

    // A date-only expiry (YYYY-MM-DD) stays valid through the end of that day
    let expiresAtValue: string | null = null;
    if (expires_at) {
      const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(expires_at) ? `${expires_at}T23:59:59.999Z` : expires_at);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid expiry date" }, { status: 400 });
      }
      expiresAtValue = parsed.toISOString();
    }

    const finalStatus = status || "active";

    // Preserve the original start date when editing an existing subscription
    const { data: existing } = await supabase
      .from("user_subscriptions")
      .select("started_at, cancelled_at")
      .eq("user_id", user_id)
      .maybeSingle();

    const record: Record<string, unknown> = {
      user_id,
      plan,
      status: finalStatus,
      ...limits,
      currency: currency || "INR",
      expires_at: expiresAtValue,
      started_at: existing?.started_at ?? new Date().toISOString(),
      cancelled_at: finalStatus === "cancelled" ? (existing?.cancelled_at ?? new Date().toISOString()) : null,
    };
    if (reset_usage) {
      record.calls_used = 0;
      record.minutes_used = 0;
    }

    // Upsert subscription
    const { data, error } = await supabase
      .from("user_subscriptions")
      .upsert(record, { onConflict: "user_id" })
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
