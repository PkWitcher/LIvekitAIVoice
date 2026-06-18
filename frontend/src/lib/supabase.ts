import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseKey);

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
