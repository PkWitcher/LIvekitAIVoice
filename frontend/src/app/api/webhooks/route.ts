import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerSupabase } from "@/lib/supabase-server";

const VALID_EVENTS = ["call.completed", "call.no_answer"];

// GET — list the current user's outbound webhooks
export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("webhooks")
      .select("id, url, secret, events, is_active, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, webhooks: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

// POST — register a new outbound webhook
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const url = String(body.url ?? "").trim();
    if (!/^https?:\/\/.+/.test(url)) {
      return NextResponse.json({ success: false, error: "A valid https:// URL is required" }, { status: 400 });
    }

    const events = Array.isArray(body.events) && body.events.length > 0
      ? body.events.filter((e: string) => VALID_EVENTS.includes(e))
      : VALID_EVENTS;

    const secret = randomBytes(24).toString("hex");

    const { data, error } = await supabase
      .from("webhooks")
      .insert({ user_id: user.id, url, events, secret })
      .select("id, url, secret, events, is_active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, webhook: data });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
