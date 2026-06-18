import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) return null;

  _supabase = createClient(url, key);
  return _supabase;
}

export interface CallLog {
  id: string;
  phone_number: string;
  direction: "outbound" | "inbound";
  status: "initiated" | "connected" | "completed" | "failed";
  duration_seconds: number | null;
  room_name: string | null;
  model_provider: string;
  voice_id: string;
  prompt: string | null;
  error: string | null;
  created_at: string;
  ended_at: string | null;
}
