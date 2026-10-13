// AI call-disposition classification — derives outcome + a one-line summary from the
// call transcript we already store, so Analytics can report conversion rate / disposition
// breakdown without any extra manual tagging.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

export const DISPOSITIONS = [
  "Interested",
  "Not Interested",
  "Callback Requested",
  "Booked",
  "Wrong Number",
  "Voicemail",
  "Other",
] as const;

export type Disposition = (typeof DISPOSITIONS)[number] | "No Answer" | "Failed" | "No Response";

// Dispositions that count as a "conversion" for the Analytics conversion-rate metric
export const POSITIVE_DISPOSITIONS: readonly string[] = ["Interested", "Booked", "Callback Requested"];

export interface DispositionResult {
  disposition: string;
  summary: string;
}

/** Classify a call transcript into a fixed disposition + one-line summary via OpenAI. */
export async function classifyDisposition(transcript: string): Promise<DispositionResult | null> {
  if (!OPENAI_API_KEY || !transcript.trim()) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `Classify the outcome of this phone call transcript into exactly one of: ${DISPOSITIONS.join(", ")}. ` +
              `Respond with JSON only: {"disposition": "<one of the categories>", "summary": "<one short sentence summarizing the call>"}.`,
          },
          { role: "user", content: transcript.slice(0, 6000) },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    const disposition = DISPOSITIONS.includes(parsed.disposition) ? parsed.disposition : "Other";
    return { disposition, summary: String(parsed.summary ?? "").slice(0, 300) };
  } catch {
    return null;
  }
}
