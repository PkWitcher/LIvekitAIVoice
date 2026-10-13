import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabase } from "@/lib/supabase-server";

const AGENT_COLUMNS =
  "id, group_id, name, use_case, language, voice_provider, voice_id, llm_provider, temperature, first_message, system_prompt, variables, status, version, is_current, created_at, updated_at";

// POST — duplicate an agent into a brand new lineage (version 1, draft status)
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

    const { data: source, error: fetchError } = await supabase
      .from("agents")
      .select(AGENT_COLUMNS)
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !source) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const newId = randomUUID();

    const { data: copy, error: insertError } = await supabase
      .from("agents")
      .insert({
        id: newId,
        group_id: newId,
        user_id: user.id,
        name: `${source.name} (Copy)`,
        use_case: source.use_case,
        language: source.language,
        voice_provider: source.voice_provider,
        voice_id: source.voice_id,
        llm_provider: source.llm_provider,
        temperature: source.temperature,
        first_message: source.first_message,
        system_prompt: source.system_prompt,
        variables: source.variables,
        status: "draft",
        version: 1,
        is_current: true,
      })
      .select(AGENT_COLUMNS)
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, agent: copy });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
