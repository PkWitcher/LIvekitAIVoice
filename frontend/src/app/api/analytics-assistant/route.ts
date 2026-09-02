import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

type Call = {
  phone_number: string;
  status: string;
  duration_seconds: number | null;
};

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
};

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json({ success: false, error: "A question is required" }, { status: 400 });
    }

    const normalized = question.toLowerCase().trim();
    const scopeTerms = /call|phone|number|duration|minute|answer|pickup|completed|failed|ringing|recording|transcript|dashboard/;
    if (!scopeTerms.test(normalized)) {
      return NextResponse.json({
        success: true,
        answer: "I can only help with this dashboard's call analytics, such as call volume, durations, pickup rate, no-answer calls, and phone-number activity.",
      });
    }

    const supabaseAuth = await createServerSupabase();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });

    const { data, error } = await supabase
      .from("phone_logs")
      .select("phone_number, status, duration_seconds")
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const calls = (data ?? []) as Call[];
    const completed = calls.filter((call) => call.status === "completed");
    const noAnswer = calls.filter((call) => call.status === "no-answer");
    const durationSeconds = completed.reduce((total, call) => total + (Number(call.duration_seconds) || 0), 0);

    let answer: string;
    if (/most.*(?:call|number)|(?:which|what).*number.*most/.test(normalized)) {
      const counts = calls.reduce<Record<string, number>>((result, call) => {
        result[call.phone_number] = (result[call.phone_number] ?? 0) + 1;
        return result;
      }, {});
      const top = Object.entries(counts).sort(([, first], [, second]) => second - first)[0];
      answer = top ? `${top[0]} is the most-called number, with ${top[1]} call${top[1] === 1 ? "" : "s"}.` : "There are no call records yet.";
    } else if (/longest|highest.*duration|maximum.*duration/.test(normalized)) {
      const longest = completed.reduce<Call | null>((result, call) => !result || (call.duration_seconds ?? 0) > (result.duration_seconds ?? 0) ? call : result, null);
      answer = longest ? `The longest completed call was with ${longest.phone_number}, lasting ${formatDuration(longest.duration_seconds ?? 0)}.` : "There are no completed calls with a duration yet.";
    } else if (/minute|duration|talk time|time used/.test(normalized)) {
      answer = `Your completed calls total ${formatDuration(durationSeconds)} of talk time across ${completed.length} call${completed.length === 1 ? "" : "s"}.`;
    } else if (/pickup|answer rate|answered/.test(normalized)) {
      const pickupRate = calls.length ? Math.round((completed.length / calls.length) * 100) : 0;
      answer = `Your pickup rate is ${pickupRate}%: ${completed.length} completed call${completed.length === 1 ? "" : "s"} out of ${calls.length} total calls.`;
    } else if (/no.?answer|missed|failed/.test(normalized)) {
      answer = `You have ${noAnswer.length} no-answer call${noAnswer.length === 1 ? "" : "s"} out of ${calls.length} total calls.`;
    } else if (/how many|total|number of call|call count/.test(normalized)) {
      answer = `You have made ${calls.length} total call${calls.length === 1 ? "" : "s"}: ${completed.length} completed and ${noAnswer.length} no-answer.`;
    } else {
      answer = `Your dashboard has ${calls.length} total calls, ${completed.length} completed calls, ${noAnswer.length} no-answer calls, and ${formatDuration(durationSeconds)} of completed-call time. Ask about your most-called number, longest call, minutes used, or pickup rate.`;
    }

    return NextResponse.json({ success: true, answer });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to answer this question" }, { status: 500 });
  }
}