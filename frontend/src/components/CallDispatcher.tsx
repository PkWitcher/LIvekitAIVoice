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
  const [modelProvider] = useState("openai");
  const [voice, setVoice] = useState("EXAVITQu4vr4xnSDxMaL");
  const [language, setLanguage] = useState("multi");
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
          language,
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
    <div className="card space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Single Call</h2>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-medium">
          Quick
        </span>
      </div>

      {/* Phone Number */}
      <div>
        <label htmlFor="phone">Phone Number</label>
        <input
          id="phone"
          type="tel"
          placeholder="Enter 10-digit number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
          +91 is added automatically for 10-digit numbers
        </p>
      </div>

      {/* Prompt */}
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

      {/* Language + Model + Voice */}
      <div>
        <label htmlFor="language">Language</label>
        <select
          id="language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="multi">Auto-Detect (Multilingual)</option>
          <option value="hi">Hindi</option>
          <option value="en">English</option>
          <option value="ta">Tamil</option>
          <option value="te">Telugu</option>
          <option value="bn">Bengali</option>
          <option value="mr">Marathi</option>
          <option value="gu">Gujarati</option>
          <option value="kn">Kannada</option>
          <option value="ml">Malayalam</option>
          <option value="pa">Punjabi</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="voice">Voice</label>
          <select
            id="voice"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
          >
            <optgroup label="ElevenLabs (Multilingual)">
              <option value="EXAVITQu4vr4xnSDxMaL">Sarah — Female (Default)</option>
              <option value="21m00Tcm4TlvDq8ikWAM">Rachel — Female</option>
              <option value="XrExE9yKIg1WjnnlVkGX">Matilda — Female</option>
              <option value="ThT5KcBeYPX3keUQqHPh">Dorothy — Female</option>
              <option value="pFZP5JQG7iQjIQuC4Bku">Lily — Female</option>
              <option value="XB0fDUnXU5powFXDhCwa">Charlotte — Female</option>
              <option value="ErXwobaYiN019PkySvjV">Antoni — Male</option>
              <option value="TxGEqnHWrfWFTfGW9XjX">Josh — Male</option>
              <option value="VR6AewLTigWG4xSOukaG">Arnold — Male</option>
              <option value="29vD33N1CtxCmqQRPOHJ">Drew — Male</option>
              <option value="5Q0t7uMcjvnagumLfvZi">Paul — Male</option>
              <option value="N2lVS1w4EtoT3dr4eOWO">Callum — Male</option>
              <option value="IKne3meq5aSn9XLyUdCD">Charlie — Male</option>
              <option value="SOYHLrjzK2X1ezoPC6cr">Harry — Male</option>
              <option value="TX3LPaxmHKxFdv7VOQHJ">Liam — Male</option>
            </optgroup>
            <optgroup label="OpenAI (Multilingual)">
              <option value="shimmer">Shimmer — Female</option>
              <option value="nova">Nova — Female</option>
              <option value="alloy">Alloy — Neutral</option>
              <option value="echo">Echo — Male</option>
              <option value="onyx">Onyx — Male</option>
            </optgroup>
            <optgroup label="Deepgram (English Only)">
              <option value="aura-asteria-en">Asteria — Female</option>
              <option value="aura-orion-en">Orion — Male</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleDispatch}
        disabled={loading || !phone.trim()}
        className="w-full py-2.5 rounded-lg font-medium text-sm text-white
                   bg-blue-600 hover:bg-blue-500
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors duration-150 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="spinner" />
            Connecting…
          </>
        ) : (
          "Place Call"
        )}
      </button>

      {/* Result */}
      {result && (
        <div
          className={`text-sm px-4 py-3 rounded-lg border ${
            result.success
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {result.success ? (
            <span>
              Call dispatched — <span className="font-mono text-xs opacity-70">{result.room_name}</span>
            </span>
          ) : (
            <span>{result.error}</span>
          )}
        </div>
      )}

      {/* Recent Calls */}
      {recentCalls.length > 0 && (
        <div className="pt-4 border-t border-[var(--color-border)]">
          <p className="text-[11px] text-[var(--color-text-muted)] mb-2">Recent calls</p>
          <div className="space-y-1.5">
            {recentCalls.map((call, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5">
                <span className="font-mono text-[var(--color-text-secondary)]">{call.phone}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--color-text-muted)]">{call.time}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${call.status === "connected" ? "bg-green-500" : "bg-red-500"}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
