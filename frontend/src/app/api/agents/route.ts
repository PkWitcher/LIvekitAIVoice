import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabase } from "@/lib/supabase-server";

const AGENT_COLUMNS =
  "id, group_id, name, use_case, language, voice_provider, voice_id, llm_provider, temperature, first_message, system_prompt, variables, status, version, is_current, created_at, updated_at";

// GET — list current versions of the user's agents (optionally filtered by status)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const status = request.nextUrl.searchParams.get("status");

    let query = supabase
      .from("agents")
      .select(AGENT_COLUMNS)
      .eq("user_id", user.id)
      .eq("is_current", true)
      .order("updated_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    } else {
      query = query.neq("status", "archived");
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, agents: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

// POST — create a new agent (version 1 of a new lineage)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = (body.name ?? "").trim();
    const systemPrompt = (body.system_prompt ?? "").trim();

    if (!name || !systemPrompt) {
      return NextResponse.json(
        { success: false, error: "name and system_prompt are required" },
        { status: 400 }
      );
    }

    const id = randomUUID();

    const { data, error } = await supabase
      .from("agents")
      .insert({
        id,
        group_id: id,
        user_id: user.id,
        name,
        use_case: body.use_case ?? "custom",
        language: body.language ?? "multi",
        voice_provider: body.voice_provider ?? "cartesia",
        voice_id: body.voice_id ?? "4877b818-c7fe-4c89-b1cf-eadf8e23da72",
        llm_provider: body.llm_provider ?? "openai",
        temperature: body.temperature ?? 0.5,
        first_message: body.first_message ?? "",
        system_prompt: systemPrompt,
        variables: body.variables ?? [],
        status: body.status ?? "active",
        version: 1,
        is_current: true,
      })
      .select(AGENT_COLUMNS)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, agent: data });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
