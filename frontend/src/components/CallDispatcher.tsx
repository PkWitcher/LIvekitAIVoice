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
  const [voice, setVoice] = useState("alloy");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);

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
    } catch {
      setResult({ success: false, error: "Network error — check server" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card glow-blue-purple p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
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
          <h2 className="text-lg font-semibold text-white">Call Dispatcher</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Initiate a single AI-powered call
          </p>
        </div>
      </div>

      {/* Phone Number */}
      <div>
        <label htmlFor="phone">Phone Number</label>
        <input
          id="phone"
          type="tel"
          placeholder="+919876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      {/* Context / Prompt */}
      <div>
        <label htmlFor="prompt">Context / Prompt (optional)</label>
        <textarea
          id="prompt"
          rows={3}
          placeholder="Custom instructions for this call..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {/* Model + Voice row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="model">Model Provider</label>
          <select
            id="model"
            value={modelProvider}
            onChange={(e) => setModelProvider(e.target.value)}
          >
            <option value="groq">Groq (Llama 3)</option>
            <option value="openai">OpenAI (GPT-4o)</option>
          </select>
        </div>
        <div>
          <label htmlFor="voice">Voice</label>
          <select
            id="voice"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
          >
            <option value="alloy">Alloy (US)</option>
            <option value="echo">Echo (US)</option>
            <option value="shimmer">Shimmer (US)</option>
            <option value="anushka">Anushka (Indian — Sarvam)</option>
            <option value="aravind">Aravind (Indian — Sarvam)</option>
          </select>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleDispatch}
        disabled={loading || !phone.trim()}
        className="w-full py-2.5 rounded-lg font-medium text-sm text-white
                   bg-gradient-to-r from-blue-600 to-purple-600
                   hover:from-blue-500 hover:to-purple-500
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-200 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="spinner" />
            Connecting…
          </>
        ) : (
          "Initiate Call"
        )}
      </button>

      {/* Result */}
      {result && (
        <div
          className={`text-sm px-4 py-3 rounded-lg border ${
            result.success
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {result.success ? (
            <span>
              ✓ Call dispatched —{" "}
              <span className="font-mono text-xs opacity-80">
                {result.room_name}
              </span>
            </span>
          ) : (
            <span>✕ {result.error}</span>
          )}
        </div>
      )}
    </div>
  );
}
