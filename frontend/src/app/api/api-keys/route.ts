import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { generateApiKey } from "@/lib/apiKeys";

// GET — list the current user's API keys (never returns the raw key, only the prefix)
export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, last_used_at, revoked, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, keys: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

// POST — generate a new API key. The raw key is returned ONCE and never again.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
    }

    const { key, prefix, hash } = generateApiKey();

    const { data, error } = await supabase
      .from("api_keys")
      .insert({ user_id: user.id, name: name.trim(), key_prefix: prefix, key_hash: hash })
      .select("id, name, key_prefix, last_used_at, revoked, created_at")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, apiKey: { ...data, key } });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
