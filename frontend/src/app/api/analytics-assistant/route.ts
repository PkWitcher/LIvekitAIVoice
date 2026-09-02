import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

type Call = {
  phone_number: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
};

type ChatMessage = { role: "user" | "assistant"; text: string };

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
};

export async function POST(request: NextRequest) {
  try {
    const { question, history, threadId } = await request.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json({ success: false, error: "A question is required" }, { status: 400 });
    }

    const normalized = question.toLowerCase().trim();
    const previousQuestion = Array.isArray(history)
      ? [...history].reverse().find((message) => message?.role === "user" && typeof message.text === "string")?.text?.toLowerCase() ?? ""
      : "";
    const contextualQuestion = `${previousQuestion} ${normalized}`;
    const scopeTerms = /call|phone|number|duration|minute|answer|pickup|completed|failed|ringing|recording|transcript|dashboard|date|when/;
    if (!scopeTerms.test(contextualQuestion)) {
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

    let activeThreadId = typeof threadId === "string" ? threadId : "";
    if (activeThreadId) {
      const { data: thread } = await supabase
        .from("analytics_chat_threads")
        .select("id")
        .eq("id", activeThreadId)
        .eq("user_id", user.id)
        .single();
      if (!thread) return NextResponse.json({ success: false, error: "Chat not found" }, { status: 404 });
    } else {
      const { data: thread, error: threadError } = await supabase
        .from("analytics_chat_threads")
        .insert({ user_id: user.id, title: question.trim().slice(0, 60) })
        .select("id")
        .single();
      if (threadError || !thread) return NextResponse.json({ success: false, error: "Could not create chat" }, { status: 500 });
      activeThreadId = thread.id;
    }

    await supabase.from("analytics_chat_messages").insert({ thread_id: activeThreadId, role: "user", text: question.trim() });

    const { data, error } = await supabase
      .from("phone_logs")
      .select("phone_number, status, duration_seconds, created_at")
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const calls = (data ?? []) as Call[];
    const completed = calls.filter((call) => call.status === "completed");
    const noAnswer = calls.filter((call) => call.status === "no-answer");
    const durationSeconds = completed.reduce((total, call) => total + (Number(call.duration_seconds) || 0), 0);

    let answer: string;
    if (/longest|highest.*duration|maximum.*duration/.test(contextualQuestion)) {
      const longest = completed.reduce<Call | null>((result, call) => !result || (call.duration_seconds ?? 0) > (result.duration_seconds ?? 0) ? call : result, null);
      const date = longest ? new Date(longest.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
      answer = longest && /date|when/.test(normalized)
        ? `Your longest completed call with ${longest.phone_number} was on ${date}, and lasted ${formatDuration(longest.duration_seconds ?? 0)}.`
        : longest ? `The longest completed call was with ${longest.phone_number}, lasting ${formatDuration(longest.duration_seconds ?? 0)} on ${date}.` : "There are no completed calls with a duration yet.";
    } else if (/most.*(?:call|number)|(?:which|what).*number.*most/.test(contextualQuestion)) {
      const counts = calls.reduce<Record<string, number>>((result, call) => {
        result[call.phone_number] = (result[call.phone_number] ?? 0) + 1;
        return result;
      }, {});
      const top = Object.entries(counts).sort(([, first], [, second]) => second - first)[0];
      answer = top ? `${top[0]} is the most-called number, with ${top[1]} call${top[1] === 1 ? "" : "s"}.` : "There are no call records yet.";
    } else if (/minute|duration|talk time|time used/.test(contextualQuestion)) {
      answer = `Your completed calls total ${formatDuration(durationSeconds)} of talk time across ${completed.length} call${completed.length === 1 ? "" : "s"}.`;
    } else if (/pickup|answer rate|answered/.test(contextualQuestion)) {
      const pickupRate = calls.length ? Math.round((completed.length / calls.length) * 100) : 0;
      answer = `Your pickup rate is ${pickupRate}%: ${completed.length} completed call${completed.length === 1 ? "" : "s"} out of ${calls.length} total calls.`;
    } else if (/no.?answer|missed|failed/.test(contextualQuestion)) {
      answer = `You have ${noAnswer.length} no-answer call${noAnswer.length === 1 ? "" : "s"} out of ${calls.length} total calls.`;
    } else if (/how many|total|number of call|call count/.test(contextualQuestion)) {
      answer = `You have made ${calls.length} total call${calls.length === 1 ? "" : "s"}: ${completed.length} completed and ${noAnswer.length} no-answer.`;
    } else {
      answer = `Your dashboard has ${calls.length} total calls, ${completed.length} completed calls, ${noAnswer.length} no-answer calls, and ${formatDuration(durationSeconds)} of completed-call time. Ask about your most-called number, longest call, minutes used, or pickup rate.`;
    }

    await supabase.from("analytics_chat_messages").insert({ thread_id: activeThreadId, role: "assistant", text: answer });
    await supabase.from("analytics_chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", activeThreadId);

    return NextResponse.json({ success: true, answer, threadId: activeThreadId });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to answer this question" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createServerSupabase();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "Database unavailable" }, { status: 500 });

    const threadId = request.nextUrl.searchParams.get("threadId");
    if (threadId) {
      const { data: thread } = await supabase.from("analytics_chat_threads").select("id").eq("id", threadId).eq("user_id", user.id).single();
      if (!thread) return NextResponse.json({ success: false, error: "Chat not found" }, { status: 404 });
      const { data: messages, error } = await supabase.from("analytics_chat_messages").select("id, role, text, created_at").eq("thread_id", threadId).order("created_at");
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, messages });
    }

    const { data: threads, error } = await supabase
      .from("analytics_chat_threads")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, threads });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load chat history" }, { status: 500 });
  }
}