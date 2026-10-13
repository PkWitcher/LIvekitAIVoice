import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

// GET — recent delivery attempts for a webhook (debugging visibility for n8n/Make/Zapier etc.)
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

    const { data: webhook } = await supabase
      .from("webhooks")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!webhook) {
      return NextResponse.json({ success: false, error: "Webhook not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("webhook_deliveries")
      .select("id, event, status_code, success, error, created_at")
      .eq("webhook_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deliveries: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
