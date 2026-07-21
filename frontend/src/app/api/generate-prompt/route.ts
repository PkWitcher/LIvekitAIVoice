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
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: `You are a prompt engineer for Nova AI — an automated AI phone calling platform that makes real phone calls. Given a brief description, generate a COMPLETE, STRUCTURED call script prompt.

ALWAYS follow this exact structure:

1. PERSONA LINE: "You are [Name], a [role] calling from [company]. This is a live phone call in [language]."

2. RULES SECTION: List 5-7 rules using "- " bullets:
   - Language rule (speak only in specified language, use romanized text for Hindi like "Namaste, mera naam...")
   - Keep every response under 15 words
   - Ask ONE question at a time, then STOP and wait for answer
   - Sound natural, friendly, warm — not robotic or scripted
   - Never speak more than 2 sentences at once
   - Add relevant rules for the scenario

3. CALL FLOW SECTION: "CALL FLOW:" followed by numbered steps 1-10:
   - Step 1: Always a warm greeting with name and company
   - Step 2: Handle "busy" response
   - Steps 3-8: Core questions/purpose (one per step)
   - Step 9: Confirm next action
   - Step 10: Thank warmly and end
   - Each step should have an example phrase in the call language

4. EDGE CASES: 3-5 "IF [scenario]: [response]" lines:
   - Handle price questions, objections, confusion, "not interested"
   - Each response should be warm and empathetic

5. BOUNDARIES: 2-3 "NEVER [rule]" lines:
   - Things the agent must never do (make up info, be pushy, etc.)

IMPORTANT RULES:
- If the brief mentions Hindi or an Indian context, write all example phrases in romanized Hindi (like "Namaste", "Kya aapke paas do minute hain?")
- If no language specified, default to English
- Use the ACTUAL details from the brief (names, dates, prices, products) — never use placeholders like [name]
- Make it emotionally warm — the agent should sound like a caring human, not a robot
- Add personality touches (empathy, humor where appropriate, genuine interest)
- Output ONLY the prompt text — no markdown headers, no code blocks, no explanations`,
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
