import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: true, calls: [] });
    }

    // Auto-expire ringing calls older than 60 seconds
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    await supabase
      .from("phone_logs")
      .update({ status: "no-answer", ended_at: new Date().toISOString() })
      .eq("status", "ringing")
      .lt("created_at", cutoff);

    const { data, error } = await supabase
      .from("phone_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, calls: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
