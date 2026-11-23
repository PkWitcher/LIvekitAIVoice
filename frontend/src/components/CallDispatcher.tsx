"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { FormEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  PhoneCall,
  Sparkles,
  RefreshCw,
  Star,
  Trash2,
  Info,
  CircleCheck,
  CircleAlert,
  TriangleAlert,
  MessageSquare,
  X,
} from "lucide-react";
import LiveTranscript from "@/components/LiveTranscript";
import { substituteVariables, type PromptVariable } from "@/lib/promptVariables";
import { normalizePhoneNumber } from "@/lib/phoneListParser";
import "@/styles/calls.css";

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

interface Agent {
  id: string;
  group_id: string;
  name: string;
  language: string;
  voice_provider: string;
  voice_id: string;
  llm_provider: string;
  temperature: number;
  first_message: string;
  system_prompt: string;
  variables: PromptVariable[];
}

type ResultKind = "success" | "error" | "limit";

interface RecentCall {
  phone: string;
  time: string;
  ok: boolean;
  room?: string;
}

const COUNTRY_PREFIXES: [string, string][] = [
  ["+91", "India"], ["+1", "US / Canada"], ["+44", "United Kingdom"], ["+971", "UAE"], ["+65", "Singapore"],
  ["+61", "Australia"], ["+49", "Germany"], ["+33", "France"], ["+81", "Japan"], ["+86", "China"],
  ["+92", "Pakistan"], ["+880", "Bangladesh"], ["+94", "Sri Lanka"], ["+977", "Nepal"], ["+966", "Saudi Arabia"],
  ["+974", "Qatar"], ["+60", "Malaysia"], ["+27", "South Africa"],
];

const LANGUAGES: [string, string][] = [
  ["multi", "Auto-detect (multilingual)"], ["hi", "Hindi"], ["en", "English"], ["ta", "Tamil"], ["te", "Telugu"],
  ["bn", "Bengali"], ["mr", "Marathi"], ["gu", "Gujarati"], ["kn", "Kannada"], ["ml", "Malayalam"], ["pa", "Punjabi"],
];

interface PhoneAnalysis {
  state: "empty" | "invalid" | "valid";
  message?: string;
  normalized?: string;
  display?: string;
  country?: string;
  note?: string;
}

function analyzePhone(raw: string): PhoneAnalysis {
  const trimmed = raw.trim();
  if (!trimmed) return { state: "empty" };

  const cleaned = trimmed.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) {
    return { state: "invalid", message: "Use digits only — spaces, dashes and a leading + are allowed." };
  }
  const digits = cleaned.replace("+", "");
  if (digits.length < 7) return { state: "invalid", message: `Too short — a phone number needs at least 7 digits (you entered ${digits.length}).` };
  if (digits.length > 15) return { state: "invalid", message: `Too long — numbers can have at most 15 digits (you entered ${digits.length}).` };

  const normalized = normalizePhoneNumber(trimmed);
  if (!normalized) return { state: "invalid", message: "This doesn't look like a valid phone number." };

  const country = COUNTRY_PREFIXES
    .filter(([prefix]) => normalized.startsWith(prefix))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1];

  let note: string | undefined;
  if (/^\d{10}$/.test(cleaned)) note = "10-digit number — +91 (India) will be added.";
  else if (!cleaned.startsWith("+")) note = "No + found — dialled as the international number shown below.";
  else if (normalized.startsWith("+91") && normalized.length !== 13) note = "Indian numbers normally have 10 digits after +91 — double-check this one.";

  const display = normalized.startsWith("+91") && normalized.length === 13
    ? `+91 ${normalized.slice(3, 8)} ${normalized.slice(8)}`
    : normalized;

  return { state: "valid", normalized, display, country, note };
}

function ConfirmDialog({
  title,
  children,
  confirmLabel,
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <div className="cl2 cl2-portal">
      <div className="cl2-overlay" onClick={onCancel}>
        <div className="cl2-modal" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
          <div className="cl2-modal-head"><h3>{title}</h3></div>
          <div className="cl2-modal-body">{children}</div>
          <div className="cl2-modal-foot">
            <button type="button" ref={cancelRef} className="cl2-btn" onClick={onCancel}>Cancel</button>
            <button type="button" className={`cl2-btn ${tone === "danger" ? "cl2-btn-danger" : "cl2-btn-primary"}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function CallDispatcher() {
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [modelProvider, setModelProvider] = useState("openai");
  const [voice, setVoice] = useState("4877b818-c7fe-4c89-b1cf-eadf8e23da72");
  const [language, setLanguage] = useState("multi");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);
  const [resultKind, setResultKind] = useState<ResultKind>("success");
  const [resultPhone, setResultPhone] = useState("");
  const [activeRoomName, setActiveRoomName] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [genError, setGenError] = useState("");
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedPrompt | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [temperature, setTemperature] = useState<number | undefined>(undefined);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;
  const analysis = useMemo(() => analyzePhone(phone), [phone]);
  const showPhoneError = analysis.state === "invalid" || (phoneTouched && analysis.state === "empty");

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (data.success) setAgents(data.agents ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    if (!agentId) {
      setFirstMessage("");
      setTemperature(undefined);
      return;
    }
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    setPrompt(agent.system_prompt);
    setFirstMessage(agent.first_message);
    setLanguage(agent.language);
    setVoice(agent.voice_id);
    setModelProvider(agent.llm_provider);
    setTemperature(agent.temperature);
    const defaults: Record<string, string> = {};
    (agent.variables ?? []).forEach((v) => (defaults[v.name] = v.default_value || ""));
    setVariableValues(defaults);
    setGenerated(false);
  };

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
        setToast({ kind: "success", text: "Script saved" });
      } else {
        setToast({ kind: "error", text: data.error || "Could not save the script" });
      }
    } catch {
      setToast({ kind: "error", text: "Network error — script not saved" });
    } finally { setSaving(false); }
  };

  const handleDeletePrompt = async (id: string) => {
    try {
      const res = await fetch(`/api/prompts?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
      setToast({ kind: "success", text: "Script deleted" });
    } catch {
      setToast({ kind: "error", text: "Could not delete the script" });
    }
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

  const handleGenerate = async () => {
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
    } catch { setGenError("Network error — could not reach the server"); }
    finally { setGenerating(false); }
  };

  const handleDispatch = async (e?: FormEvent) => {
    e?.preventDefault();
    setPhoneTouched(true);
    if (loading || analysis.state !== "valid" || !analysis.normalized) return;
    setLoading(true);
    setResult(null);

    const dialed = analysis.normalized;
    const finalPrompt = selectedAgent ? substituteVariables(prompt, variableValues) : prompt;
    const finalFirstMessage = selectedAgent ? substituteVariables(firstMessage, variableValues) : firstMessage;

    let data: DispatchResult;
    let kind: ResultKind = "error";
    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: dialed,
          prompt: finalPrompt.trim(),
          model_provider: modelProvider,
          voice_id: voice,
          language,
          agent_id: selectedAgent?.group_id,
          tts_provider: selectedAgent?.voice_provider,
          temperature,
          first_message: finalFirstMessage.trim(),
          name: variableValues.name,
        }),
      });

      data = await res.json();
      if (data.success) kind = "success";
      else if (res.status === 403) kind = "limit";
      else if (res.status === 401) data = { success: false, error: "Your session has expired — please sign in again." };
    } catch {
      data = { success: false, error: "Network error — could not reach the server" };
    }

    setResult(data);
    setResultKind(kind);
    setResultPhone(dialed);
    if (data.success && data.room_name) {
      setActiveRoomName(data.room_name);
    }
    setRecentCalls((prev) => [
      {
        phone: dialed,
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        ok: data.success,
        room: data.room_name,
      },
      ...prev.slice(0, 4),
    ]);
    setLoading(false);
  };

  const sortedSaved = useMemo(() => [...savedPrompts].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0)), [savedPrompts]);
  const unresolvedVars = selectedAgent
    ? (selectedAgent.variables ?? []).filter((v) => !(variableValues[v.name] ?? "").trim()).map((v) => v.name)
    : [];

  return (
    <section className="cl2 cl2-panel" aria-label="Single call">
      <div className="cl2-panel-head">
        <div>
          <h2 className="cl2-title">Single call</h2>
          <p className="cl2-muted">Place one AI-powered outbound call right now.</p>
        </div>
        <span className="cl2-pill cl2-pill-info"><span className="cl2-pill-dot" aria-hidden="true" />Quick dial</span>
      </div>

      <form className="cl2-form" onSubmit={handleDispatch} noValidate>
        <fieldset className="cl2-fieldset" disabled={loading}>
          <div className="cl2-split">
            <div className="cl2-stack">
              {agents.length > 0 && (
                <div className="cl2-field">
                  <label htmlFor="agent-select" className="cl2-label">Saved agent <span className="cl2-optional">optional</span></label>
                  <select
                    id="agent-select"
                    className="cl2-input"
                    value={selectedAgentId}
                    onChange={(e) => handleSelectAgent(e.target.value)}
                  >
                    <option value="">— Manual script —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <p className="cl2-hint">Selecting an agent fills in its script, voice, language and model.</p>
                  {selectedAgent && selectedAgent.variables.length > 0 && (
                    <div className="cl2-vars">
                      {selectedAgent.variables.map((v) => (
                        <div key={v.name} className="cl2-var-row">
                          <label htmlFor={`var-${v.name}`} className="cl2-var-token">{"{{" + v.name + "}}"}</label>
                          <input
                            id={`var-${v.name}`}
                            type="text"
                            className="cl2-input cl2-input-sm"
                            placeholder="Value for this call"
                            value={variableValues[v.name] ?? ""}
                            onChange={(e) => setVariableValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                          />
                        </div>
                      ))}
                      {unresolvedVars.length > 0 && (
                        <p className="cl2-hint cl2-text-warn">
                          Empty variables are left as-is in the script: {unresolvedVars.map((n) => `{{${n}}}`).join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="cl2-field">
                <label htmlFor="phone" className="cl2-label">Phone number</label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className={`cl2-input cl2-mono ${showPhoneError ? "is-invalid" : analysis.state === "valid" ? "is-valid" : ""}`}
                  placeholder="98765 43210 or +1 415 555 0100"
                  value={phone}
                  aria-invalid={showPhoneError}
                  aria-describedby="phone-help"
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setPhoneTouched(true)}
                />
                <div id="phone-help" className="cl2-field-help" aria-live="polite">
                  {showPhoneError ? (
                    <p className="cl2-hint cl2-text-danger">
                      {analysis.state === "empty" ? "Enter the phone number to call." : analysis.message}
                    </p>
                  ) : analysis.state === "valid" ? (
                    <>
                      <p className="cl2-phone-preview">
                        <CircleCheck size={13} aria-hidden="true" />
                        <span>Will dial <strong className="cl2-mono">{analysis.display}</strong>{analysis.country ? ` · ${analysis.country}` : ""}</span>
                      </p>
                      {analysis.note && <p className="cl2-hint cl2-text-warn">{analysis.note}</p>}
                    </>
                  ) : (
                    <p className="cl2-hint">Include the country code (e.g. +91). 10-digit numbers are treated as Indian (+91).</p>
                  )}
                </div>
              </div>

              <div className="cl2-form-row">
                <div className="cl2-field">
                  <label htmlFor="language" className="cl2-label">Language</label>
                  <select id="language" className="cl2-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="cl2-field">
                  <label htmlFor="voice" className="cl2-label">Voice</label>
                  <select id="voice" className="cl2-input" value={voice} onChange={(e) => setVoice(e.target.value)}>
                    <optgroup label="Cartesia Indian (Hindi/English — recommended)">
                      <option value="4877b818-c7fe-4c89-b1cf-eadf8e23da72">Rohan — Hindi male (default)</option>
                      <option value="0f14d8cb-f039-41fe-a813-a9b4bee7eed8">Hindi female</option>
                      <option value="1259b7e3-cb8a-43df-9446-30971a46b8b0">English voice</option>
                    </optgroup>
                    <optgroup label="OpenAI (multilingual)">
                      <option value="shimmer">Shimmer — female</option>
                      <option value="nova">Nova — female</option>
                      <option value="alloy">Alloy — neutral</option>
                      <option value="echo">Echo — male</option>
                      <option value="onyx">Onyx — male</option>
                    </optgroup>
                    <optgroup label="Deepgram (English only)">
                      <option value="aura-asteria-en">Asteria — female</option>
                      <option value="aura-orion-en">Orion — male</option>
                    </optgroup>
                    <optgroup label="ElevenLabs">
                      <option value="RABOvaPec1ymXz02oDQi">Indian voice 1</option>
                      <option value="czQ9pLzjRaF61EAYjcPC">Indian voice 2</option>
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>

            <div className="cl2-stack">
              <div className="cl2-field">
                <label htmlFor="brief" className="cl2-label">Describe the call <span className="cl2-optional">AI script generator</span></label>
                <div className="cl2-inline">
                  <input
                    id="brief"
                    type="text"
                    className="cl2-input"
                    placeholder="e.g. Remind about appointment on June 20 at 3 PM"
                    value={brief}
                    onChange={(e) => { setBrief(e.target.value); setGenerated(false); setGenError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGenerate(); } }}
                  />
                  <button type="button" className="cl2-btn cl2-btn-primary" onClick={handleGenerate} disabled={generating || !brief.trim()}>
                    {generating ? (
                      <><span className="cl2-spin" aria-hidden="true" /> Generating…</>
                    ) : generated ? (
                      <><RefreshCw size={14} aria-hidden="true" /> Regenerate</>
                    ) : (
                      <><Sparkles size={14} aria-hidden="true" /> Generate</>
                    )}
                  </button>
                </div>
                {generated && <p className="cl2-hint cl2-text-ok" role="status">Script generated and added below — edit it before calling if you like.</p>}
                {genError && <p className="cl2-hint cl2-text-danger" role="alert">{genError}</p>}
                {!generated && !genError && <p className="cl2-hint">Describe what the call is about and AI will write the full script.</p>}
              </div>

              <div className="cl2-field cl2-grow">
                <div className="cl2-label-row">
                  <label htmlFor="prompt" className="cl2-label">Call script</label>
                  <div className="cl2-label-actions">
                    {savedPrompts.length > 0 && (
                      <button type="button" className="cl2-link" onClick={() => setShowSavedList(!showSavedList)}>
                        {showSavedList ? "Hide saved scripts" : "Manage saved scripts"}
                      </button>
                    )}
                    {prompt.trim() && (
                      <button type="button" className="cl2-link" onClick={() => setShowSaveInput(!showSaveInput)}>
                        {showSaveInput ? "Cancel" : "Save script"}
                      </button>
                    )}
                  </div>
                </div>

                {savedPrompts.length > 0 && (
                  <select
                    aria-label="Load a saved script"
                    onChange={(e) => {
                      const selected = savedPrompts.find((p) => p.id === e.target.value);
                      if (selected) setPrompt(selected.prompt);
                      e.target.value = "";
                    }}
                    defaultValue=""
                    className="cl2-input cl2-input-sm"
                  >
                    <option value="" disabled>Load a saved script ({savedPrompts.length})…</option>
                    {sortedSaved.some((p) => p.starred) && (
                      <optgroup label="Starred">
                        {sortedSaved.filter((p) => p.starred).map((sp) => (
                          <option key={sp.id} value={sp.id}>★ {sp.title}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="All scripts">
                      {sortedSaved.filter((p) => !p.starred).map((sp) => (
                        <option key={sp.id} value={sp.id}>{sp.title}</option>
                      ))}
                    </optgroup>
                  </select>
                )}

                {showSaveInput && (
                  <div className="cl2-inline">
                    <input
                      type="text"
                      className="cl2-input cl2-input-sm"
                      placeholder="Give this script a name…"
                      aria-label="Script name"
                      value={saveTitle}
                      onChange={(e) => setSaveTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSavePrompt(); } }}
                    />
                    <button type="button" className="cl2-btn cl2-btn-primary cl2-btn-sm" onClick={handleSavePrompt} disabled={saving || !saveTitle.trim()}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}

                {showSavedList && savedPrompts.length > 0 && (
                  <ul className="cl2-list" aria-label="Saved scripts">
                    {sortedSaved.map((sp) => (
                      <li key={sp.id}>
                        <button type="button" className="cl2-list-main" onClick={() => setPrompt(sp.prompt)} title="Use this script">
                          <span className="cl2-strong">{sp.title}</span>
                          <span className="cl2-muted cl2-truncate">{sp.prompt.slice(0, 80)}</span>
                        </button>
                        <button
                          type="button"
                          className={`cl2-icon-btn ${sp.starred ? "is-starred" : ""}`}
                          onClick={() => handleStarPrompt(sp.id, !sp.starred)}
                          aria-label={sp.starred ? `Unstar ${sp.title}` : `Star ${sp.title}`}
                          aria-pressed={sp.starred}
                        >
                          <Star size={14} fill={sp.starred ? "currentColor" : "none"} aria-hidden="true" />
                        </button>
                        <button type="button" className="cl2-icon-btn cl2-icon-danger" onClick={() => setDeleteTarget(sp)} aria-label={`Delete ${sp.title}`}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <textarea
                  id="prompt"
                  rows={9}
                  className="cl2-input cl2-textarea"
                  placeholder="Generated script will appear here, or type your own…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <p className="cl2-hint cl2-hint-row">
                  <span>{prompt.trim() ? `${prompt.trim().length.toLocaleString("en-IN")} characters` : "No script yet — the agent will use its defaults."}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="cl2-actions">
            <button type="submit" className="cl2-btn cl2-btn-primary cl2-btn-lg" disabled={loading || analysis.state !== "valid"}>
              {loading ? (
                <><span className="cl2-spin" aria-hidden="true" /> Connecting…</>
              ) : (
                <><PhoneCall size={16} aria-hidden="true" /> Place call</>
              )}
            </button>
            {!loading && analysis.state !== "valid" && (
              <span className="cl2-muted">Enter a valid phone number to enable calling.</span>
            )}
          </div>
        </fieldset>
      </form>

      <div aria-live="polite">
        {result && resultKind === "success" && (
          <div className="cl2-result cl2-result-ok" role="status">
            <CircleCheck size={18} aria-hidden="true" />
            <div className="cl2-result-body">
              <strong>Call dispatched to <span className="cl2-mono">{resultPhone}</span></strong>
              <span className="cl2-muted">The agent is dialling now. Reference: <span className="cl2-mono cl2-break">{result.room_name}</span></span>
            </div>
            <button
              type="button"
              className="cl2-btn cl2-btn-sm"
              onClick={() => { setActiveRoomName(result.room_name ?? null); setShowTranscript(true); }}
            >
              <MessageSquare size={13} aria-hidden="true" /> Live transcript
            </button>
          </div>
        )}
        {result && resultKind === "limit" && (
          <div className="cl2-result cl2-result-warn" role="alert">
            <TriangleAlert size={18} aria-hidden="true" />
            <div className="cl2-result-body">
              <strong>Plan limit reached</strong>
              <span>{result.error}</span>
              <span className="cl2-muted">Calls are paused until your plan is active or upgraded — contact your admin or upgrade your plan to continue.</span>
            </div>
          </div>
        )}
        {result && resultKind === "error" && (
          <div className="cl2-result cl2-result-danger" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <div className="cl2-result-body">
              <strong>Call could not be placed</strong>
              <span>{result.error || "Something went wrong. Please try again."}</span>
            </div>
            <button type="button" className="cl2-btn cl2-btn-sm" onClick={() => handleDispatch()} disabled={loading}>
              <RefreshCw size={13} aria-hidden="true" /> Retry
            </button>
          </div>
        )}
      </div>

      {recentCalls.length > 0 && (
        <div className="cl2-recent">
          <span className="cl2-label">Placed this session</span>
          <ul>
            {recentCalls.map((call, i) => (
              <li key={i}>
                <span className="cl2-mono cl2-strong">{call.phone}</span>
                <span className="cl2-muted">{call.time}</span>
                <span className={`cl2-pill ${call.ok ? "cl2-pill-ok" : "cl2-pill-danger"}`}>
                  <span className="cl2-pill-dot" aria-hidden="true" />{call.ok ? "Dispatched" : "Failed"}
                </span>
                {call.ok && call.room && (
                  <button
                    type="button"
                    className="cl2-link"
                    onClick={() => { setActiveRoomName(call.room ?? null); setShowTranscript(true); }}
                  >
                    Transcript
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <LiveTranscript
        roomName={activeRoomName}
        phoneNumber={recentCalls.find((c) => c.room === activeRoomName)?.phone}
        isOpen={showTranscript}
        onClose={() => setShowTranscript(false)}
      />

      {deleteTarget && (
        <ConfirmDialog
          title="Delete saved script?"
          confirmLabel="Delete"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { handleDeletePrompt(deleteTarget.id); setDeleteTarget(null); }}
        >
          <p><strong>{deleteTarget.title}</strong> will be permanently removed from your saved scripts. This can&apos;t be undone.</p>
        </ConfirmDialog>
      )}

      {toast && createPortal(
        <div className="cl2 cl2-portal">
          <div className={`cl2-toast cl2-toast-${toast.kind}`} role="status">
            {toast.kind === "success" ? <CircleCheck size={15} aria-hidden="true" /> : <Info size={15} aria-hidden="true" />}
            <span>{toast.text}</span>
            <button type="button" className="cl2-toast-close" onClick={() => setToast(null)} aria-label="Dismiss"><X size={13} aria-hidden="true" /></button>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
