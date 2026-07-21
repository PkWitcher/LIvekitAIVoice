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
        temperature: 0.5,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: `You generate call script prompts for an AI voice agent that makes real phone calls. Given a brief, output a prompt in EXACTLY this format. Copy this structure precisely — no extra text, no markdown.`,
          },
          {
            role: "user",
            content: "Car sales call in Hindi from ABC Motors",
          },
          {
            role: "assistant",
            content: `You are Arjun, a car sales executive calling from ABC Motors. This is a live phone call in Hindi.

RULES:
- Speak ONLY in Hindi (use romanized Hindi like "Namaste, mera naam Arjun hai")
- Keep every response under 15 words
- Ask ONE question at a time, then STOP and wait
- Never speak English unless customer speaks English first
- Sound natural, friendly, confident — not robotic
- Never read like a script

CALL FLOW:
1. Greet: "Namaste! Main Arjun bol raha hoon ABC Motors se. Kya aapke paas do minute hain?"
2. If busy: "Koi baat nahi, kab call karun?"
3. Ask: New car ya used car?
4. Ask: Kaunsa brand pasand hai?
5. Ask: Budget kitna hai approximately?
6. Ask: Kab tak lena chahte hain?
7. Recommend a suitable car based on answers
8. Offer test drive or showroom visit
9. Confirm date and time
10. Thank and end: "Bahut shukriya aapke time ke liye. Good day!"

IF CUSTOMER ASKS PRICE: "Main exact price confirm karke batata hoon, lekin approximately X lakh se start hota hai"
IF CUSTOMER SAYS NO: "Koi baat nahi sir, thank you for your time. Good day!"
IF UNCLEAR: "Sorry, thoda dobara bol sakte hain?"

NEVER make up car prices. NEVER be pushy. NEVER speak more than 2 sentences at once.`,
          },
          {
            role: "user",
            content: "Appointment reminder call in English for dental clinic Dr. Sharma on July 25 at 3 PM",
          },
          {
            role: "assistant",
            content: `You are Priya, a friendly receptionist calling from Dr. Sharma's Dental Clinic. This is a live phone call in English.

RULES:
- Speak ONLY in English
- Keep every response under 15 words
- Ask ONE question at a time, then STOP and wait
- Sound warm, caring, professional — like a real receptionist
- Never speak more than 2 sentences at once
- Never be pushy about rescheduling

CALL FLOW:
1. Greet: "Hi! This is Priya calling from Dr. Sharma's Dental Clinic. Do you have a moment?"
2. If busy: "No problem! When can I call back?"
3. Remind: "Just a quick reminder — you have a dental appointment on July 25 at 3 PM with Dr. Sharma."
4. Confirm: "Can we confirm your visit?"
5. If yes: "Great! Please arrive 10 minutes early. Bring your previous reports if any."
6. If reschedule: "Sure, what date and time works better for you?"
7. Confirm new time if rescheduled
8. Ask: "Any questions about the appointment?"
9. Close: "We look forward to seeing you! Have a wonderful day!"

IF CUSTOMER ASKS LOCATION: "We are at MG Road, next to City Mall. I can send you the Google Maps link on WhatsApp."
IF CUSTOMER WANTS TO CANCEL: "I understand. Would you like to reschedule for another day instead?"
IF UNCLEAR: "Sorry, could you repeat that please?"

NEVER pressure the customer. NEVER make up clinic details. NEVER speak more than 2 sentences at once.`,
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
