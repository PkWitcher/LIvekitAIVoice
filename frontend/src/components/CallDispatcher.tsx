"use client";

import { useState, useEffect, useCallback } from "react";
import LiveTranscript from "@/components/LiveTranscript";

interface DispatchResult {
  success: boolean;
  room_name?: string;
  error?: string;
}

interface SavedPrompt {
  id: string;
  title: string;
  prompt: string;
  starred: boolean;
  created_at: string;
}

export default function CallDispatcher() {
  const [phone, setPhone] = useState("");
  const [prompt, setPrompt] = useState("");
  const [modelProvider] = useState("openai");
  const [voice, setVoice] = useState("4877b818-c7fe-4c89-b1cf-eadf8e23da72");
  const [language, setLanguage] = useState("multi");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);
  const [activeRoomName, setActiveRoomName] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [recentCalls, setRecentCalls] = useState<
    { phone: string; time: string; status: string }[]
  >([]);
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [genError, setGenError] = useState("");
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);

  const fetchSavedPrompts = useCallback(async () => {
    try {
      const res = await fetch("/api/prompts");
      const data = await res.json();
      if (data.success) setSavedPrompts(data.prompts ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchSavedPrompts(); }, [fetchSavedPrompts]);

  const handleSavePrompt = async () => {
    if (!saveTitle.trim() || !prompt.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: saveTitle.trim(), prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSaveInput(false);
        setSaveTitle("");
        fetchSavedPrompts();
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleDeletePrompt = async (id: string) => {
    try {
      await fetch(`/api/prompts?id=${id}`, { method: "DELETE" });
      setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch { /* silent */ }
  };

  const handleStarPrompt = async (id: string, starred: boolean) => {
    try {
      await fetch("/api/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, starred }),
      });
      setSavedPrompts((prev) =>
        prev.map((p) => p.id === id ? { ...p, starred } : p)
          .sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))
      );
    } catch { /* silent */ }
  };

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

      {/* Prompt Brief + Generate */}
      <div>
        <label htmlFor="brief">Describe your call briefly</label>
        <div className="flex gap-2">
          <input
            id="brief"
            type="text"
            placeholder="e.g. Remind about appointment on June 20 at 3 PM"
            value={brief}
            onChange={(e) => { setBrief(e.target.value); setGenerated(false); setGenError(""); }}
            className="flex-1"
          />
          <button
            onClick={async () => {
              if (!brief.trim()) return;
              setGenerating(true);
              setGenError("");
              setGenerated(false);
              try {
                const res = await fetch("/api/generate-prompt", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ brief: brief.trim() }),
                });
                const data = await res.json();
                if (data.success && data.prompt) {
                  setPrompt(data.prompt);
                  setGenerated(true);
                } else {
                  setGenError(data.error || "Failed to generate");
                }
              } catch { setGenError("Network error"); }
              finally { setGenerating(false); }
            }}
            disabled={generating || !brief.trim()}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white
                       bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap"
          >
            {generating ? (
              <><span className="spinner" style={{ width: 12, height: 12 }} /> Generating...</>
            ) : generated ? (
              <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg> Regenerate</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" /></svg> Generate</>
            )}
          </button>
        </div>
        {generated && (
          <p className="text-[11px] text-green-400 mt-1.5">✓ Script generated and pasted below. You can edit it before calling.</p>
        )}
        {genError && (
          <p className="text-[11px] text-red-400 mt-1.5">{genError}</p>
        )}
        {!generated && !genError && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
            Describe what the call is about and AI will generate a full script
          </p>
        )}
      </div>

      {/* Generated / Manual Prompt */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="prompt" className="mb-0">Call Script</label>
          <div className="flex items-center gap-2">
            {prompt.trim() && (
              <button
                onClick={() => setShowSaveInput(!showSaveInput)}
                className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
              >
                {showSaveInput ? "Cancel" : "Save Script"}
              </button>
            )}
          </div>
        </div>

        {/* Saved Prompts Dropdown */}
        {savedPrompts.length > 0 && (
          <div className="mb-2">
            <select
              onChange={(e) => {
                const selected = savedPrompts.find((p) => p.id === e.target.value);
                if (selected) setPrompt(selected.prompt);
                e.target.value = "";
              }}
              defaultValue=""
              className="!py-1.5 !text-xs w-full"
            >
              <option value="" disabled>Select a saved script ({savedPrompts.length})...</option>
              {savedPrompts.filter(p => p.starred).length > 0 && (
                <optgroup label="⭐ Starred">
                  {savedPrompts.filter(p => p.starred).map((sp) => (
                    <option key={sp.id} value={sp.id}>⭐ {sp.title}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="All Scripts">
                {savedPrompts.filter(p => !p.starred).map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.title}</option>
                ))}
              </optgroup>
            </select>
          </div>
        )}

        {/* Save input */}
        {showSaveInput && (
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Give this script a name..."
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              className="flex-1 !py-1.5 !text-xs"
            />
            <button
              onClick={handleSavePrompt}
              disabled={saving || !saveTitle.trim()}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        {/* Manage saved prompts (star/delete) */}
        {savedPrompts.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setShowSavedList(!showSavedList)}
              className="text-[10px] text-[var(--color-text-muted)] hover:text-white transition-colors"
            >
              {showSavedList ? "Hide manage" : "Manage saved scripts"}
            </button>
          </div>
        )}
        {showSavedList && savedPrompts.length > 0 && (
          <div className="mb-2 max-h-48 overflow-y-auto rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {savedPrompts.map((sp) => (
              <div
                key={sp.id}
                className="flex items-center justify-between px-3 py-2 hover:bg-white/[0.03] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-white block truncate">{sp.starred ? "⭐ " : ""}{sp.title}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] block truncate">{sp.prompt.substring(0, 50)}...</span>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleStarPrompt(sp.id, !sp.starred)}
                    className={`p-1 rounded transition-all ${sp.starred ? "text-yellow-400" : "text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100"}`}
                    title={sp.starred ? "Unstar" : "Star"}
                  >
                    <svg className="w-3.5 h-3.5" fill={sp.starred ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeletePrompt(sp.id)}
                    className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <textarea
          id="prompt"
          rows={8}
          placeholder="Generated script will appear here, or type your own..."
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
            <optgroup label="Cartesia Indian (Hindi/English — Recommended)">
              <option value="4877b818-c7fe-4c89-b1cf-eadf8e23da72">Rohan — Hindi Male (Default)</option>
              <option value="0f14d8cb-f039-41fe-a813-a9b4bee7eed8">Hindi Female</option>
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
            <div className="flex items-center justify-between">
              <span>
                Call dispatched — <span className="font-mono text-xs opacity-70">{result.room_name}</span>
              </span>
              <button
                onClick={() => { setActiveRoomName(result.room_name ?? null); setShowTranscript(true); }}
                className="ml-2 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors whitespace-nowrap"
              >
                Live Transcript
              </button>
            </div>
          ) : (
            <span>{result.error}</span>
          )}
        </div>
      )}

      {/* Live Transcript Sidebar */}
      <LiveTranscript
        roomName={activeRoomName}
        isOpen={showTranscript}
        onClose={() => setShowTranscript(false)}
      />

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
