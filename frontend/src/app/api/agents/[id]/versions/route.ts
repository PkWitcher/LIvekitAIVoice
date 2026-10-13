import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

const AGENT_COLUMNS =
  "id, group_id, name, use_case, language, voice_provider, voice_id, llm_provider, temperature, first_message, system_prompt, variables, status, version, is_current, created_at, updated_at";

// GET — list every version in this agent's lineage, newest first
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: anchor, error: anchorError } = await supabase
      .from("agents")
      .select("group_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (anchorError || !anchor) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("agents")
      .select(AGENT_COLUMNS)
      .eq("group_id", anchor.group_id)
      .eq("user_id", user.id)
      .order("version", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, versions: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

// POST — restore a previous version as the current one (no new version is created)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { version } = await request.json();
    if (typeof version !== "number") {
      return NextResponse.json({ success: false, error: "version is required" }, { status: 400 });
    }

    const { data: anchor, error: anchorError } = await supabase
      .from("agents")
      .select("group_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (anchorError || !anchor) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const { data: target, error: targetError } = await supabase
      .from("agents")
      .select("id")
      .eq("group_id", anchor.group_id)
      .eq("user_id", user.id)
      .eq("version", version)
      .single();

    if (targetError || !target) {
      return NextResponse.json({ success: false, error: "Version not found" }, { status: 404 });
    }

    await supabase
      .from("agents")
      .update({ is_current: false })
      .eq("group_id", anchor.group_id)
      .eq("user_id", user.id);

    const { data: restored, error: restoreError } = await supabase
      .from("agents")
      .update({ is_current: true })
      .eq("id", target.id)
      .select(AGENT_COLUMNS)
      .single();

    if (restoreError) {
      return NextResponse.json({ success: false, error: restoreError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, agent: restored });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
