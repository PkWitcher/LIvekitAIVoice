import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabase } from "@/lib/supabase-server";

const AGENT_COLUMNS =
  "id, group_id, name, use_case, language, voice_provider, voice_id, llm_provider, temperature, first_message, system_prompt, variables, status, version, is_current, created_at, updated_at";

const EDITABLE_FIELDS = [
  "name",
  "use_case",
  "language",
  "voice_provider",
  "voice_id",
  "llm_provider",
  "temperature",
  "first_message",
  "system_prompt",
  "variables",
] as const;

// GET — fetch a single agent (any version) owned by the current user
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

    const { data, error } = await supabase
      .from("agents")
      .select(AGENT_COLUMNS)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, agent: data });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

// PATCH — update an agent.
// If the body ONLY contains `status`, it's applied in place to every version in the
// lineage (archive/unarchive — no new version needed). Any other field change creates
// a new version row and marks it current, preserving the prior version untouched.
export async function PATCH(
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

    const body = await request.json();

    const { data: current, error: fetchError } = await supabase
      .from("agents")
      .select(AGENT_COLUMNS)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const bodyKeys = Object.keys(body);
    const isStatusOnlyChange = bodyKeys.length > 0 && bodyKeys.every((k) => k === "status");

    if (isStatusOnlyChange) {
      const { error } = await supabase
        .from("agents")
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq("group_id", current.group_id)
        .eq("user_id", user.id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, agent: { ...current, status: body.status } });
    }

    if (!current.is_current) {
      return NextResponse.json(
        { success: false, error: "Can only edit the current version of an agent" },
        { status: 400 }
      );
    }

    const newId = randomUUID();
    const updates: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      updates[field] = field in body ? body[field] : current[field as keyof typeof current];
    }

    const { data: newVersion, error: insertError } = await supabase
      .from("agents")
      .insert({
        id: newId,
        group_id: current.group_id,
        user_id: user.id,
        ...updates,
        status: body.status ?? current.status,
        version: current.version + 1,
        is_current: true,
      })
      .select(AGENT_COLUMNS)
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    const { error: demoteError } = await supabase
      .from("agents")
      .update({ is_current: false })
      .eq("id", id);

    if (demoteError) {
      return NextResponse.json({ success: false, error: demoteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, agent: newVersion });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

// DELETE — archive the entire agent lineage (soft delete, keeps history/versions)
export async function DELETE(
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

    const { data: current, error: fetchError } = await supabase
      .from("agents")
      .select("group_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("agents")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("group_id", current.group_id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
