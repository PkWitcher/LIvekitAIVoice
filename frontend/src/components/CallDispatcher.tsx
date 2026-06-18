"use client";

import { useState } from "react";

interface DispatchResult {
  success: boolean;
  room_name?: string;
  error?: string;
}

export default function CallDispatcher() {
  const [phone, setPhone] = useState("");
  const [prompt, setPrompt] = useState("");
  const [modelProvider, setModelProvider] = useState("groq");
  const [voice, setVoice] = useState("aura-asteria-en");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);
  const [recentCalls, setRecentCalls] = useState<
    { phone: string; time: string; status: string }[]
  >([]);

  const handleDispatch = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phone.trim(),
          prompt: prompt.trim(),
          model_provider: modelProvider,
          voice_id: voice,
        }),
      });

      const data: DispatchResult = await res.json();
      setResult(data);

      setRecentCalls((prev) => [
        {
          phone: phone.trim(),
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: data.success ? "connected" : "failed",
        },
        ...prev.slice(0, 4),
      ]);
    } catch {
      setResult({ success: false, error: "Network error — check server" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card glow-blue-purple p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/10">
            <svg
              className="w-5 h-5 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Single Call</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Dispatch one AI call instantly
            </p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium uppercase tracking-wider">
          Quick
        </span>
      </div>

      {/* Phone Number */}
      <div>
        <label htmlFor="phone">Phone Number</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm">🇮🇳</span>
          <input
            id="phone"
            type="tel"
            placeholder="Enter 10-digit number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="!pl-10"
          />
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">+91 is added automatically for 10-digit numbers</p>
      </div>

      {/* Context / Prompt */}
      <div>
        <label htmlFor="prompt">Call Script (optional)</label>
        <textarea
          id="prompt"
          rows={2}
          placeholder="e.g. Remind about appointment on June 20 at 3 PM"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {/* Model + Voice row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="model">AI Model</label>
          <select
            id="model"
            value={modelProvider}
            onChange={(e) => setModelProvider(e.target.value)}
          >
            <option value="groq">Groq — Llama 3.3 70B</option>
            <option value="openai">OpenAI — GPT-4o Mini</option>
          </select>
        </div>
        <div>
          <label htmlFor="voice">Voice</label>
          <select
            id="voice"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
          >
            <optgroup label="Deepgram (Recommended)">
              <option value="aura-asteria-en">Asteria — Female</option>
              <option value="aura-luna-en">Luna — Female</option>
              <option value="aura-stella-en">Stella — Female</option>
              <option value="aura-athena-en">Athena — Female</option>
              <option value="aura-orion-en">Orion — Male</option>
              <option value="aura-arcas-en">Arcas — Male</option>
              <option value="aura-perseus-en">Perseus — Male</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleDispatch}
        disabled={loading || !phone.trim()}
        className="w-full py-3 rounded-xl font-semibold text-sm text-white
                   bg-gradient-to-r from-blue-600 to-purple-600
                   hover:from-blue-500 hover:to-purple-500
                   hover:shadow-lg hover:shadow-blue-500/20
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-300 flex items-center justify-center gap-2
                   active:scale-[0.98]"
      >
        {loading ? (
          <>
            <span className="spinner" />
            Connecting…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
            </svg>
            Place Call
          </>
        )}
      </button>

      {/* Result */}
      {result && (
        <div
          className={`text-sm px-4 py-3 rounded-xl border flex items-center gap-2 ${
            result.success
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {result.success ? (
            <>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span>
                Call dispatched —{" "}
                <span className="font-mono text-xs opacity-70">
                  {result.room_name}
                </span>
              </span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <span>{result.error}</span>
            </>
          )}
        </div>
      )}

      {/* Recent Calls */}
      {recentCalls.length > 0 && (
        <div className="pt-3 border-t border-white/5">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Recent</p>
          <div className="space-y-1.5">
            {recentCalls.map((call, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-white/[0.02]">
                <span className="font-mono text-[var(--color-text-secondary)]">{call.phone}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-muted)]">{call.time}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${call.status === "connected" ? "bg-green-400" : "bg-red-400"}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
