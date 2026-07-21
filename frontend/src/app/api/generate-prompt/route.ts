import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

export async function POST(request: NextRequest) {
  try {
    const { brief } = await request.json();

    if (!brief || typeof brief !== "string" || brief.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "Please provide a brief description" },
        { status: 400 }
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: `You are a prompt engineer for Nova AI — an automated AI phone calling platform. Users describe a call scenario briefly, and you generate a complete system prompt that the AI voice agent will follow during the phone call.

The AI agent can:
- Make outbound calls to phone numbers
- Speak naturally in Hindi, English, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi
- Follow a script/persona during the call
- Transfer calls to a human if needed

Rules for the generated prompt:
- Start with "You are..." to define the agent's persona and role
- Include the specific purpose of the call
- Include any details from the brief (dates, times, names, amounts, etc.)
- Add instructions for how to handle common responses (interested, not interested, questions)
- Keep it 4-8 sentences — enough detail but not overwhelming
- Be conversational and natural — the agent will speak this out loud
- Include a polite closing instruction
- Do NOT use placeholder brackets like [name] or [date] — use the actual details from the brief
- Do NOT add markdown formatting
- Output ONLY the prompt text, nothing else`,
          },
          {
            role: "user",
            content: brief.trim(),
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[GENERATE-PROMPT] OpenAI error:", err);
      return NextResponse.json(
        { success: false, error: "Failed to generate prompt" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const generatedPrompt = data.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ success: true, prompt: generatedPrompt });
  } catch (err) {
    console.error("[GENERATE-PROMPT] Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
