"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Plus,
  Copy,
  Archive,
  ArchiveRestore,
  History,
  PhoneCall,
  X,
  Pencil,
  BookOpen,
} from "lucide-react";
import { AGENT_TEMPLATES, getTemplate } from "@/lib/agentTemplates";
import { extractVariableNames, mergeVariables, type PromptVariable } from "@/lib/promptVariables";
import AgentTestWidget from "@/components/AgentTestWidget";
import KnowledgeBaseManager from "@/components/KnowledgeBaseManager";

interface Agent {
  id: string;
  group_id: string;
  name: string;
  use_case: string;
  language: string;
  voice_provider: string;
  voice_id: string;
  llm_provider: string;
  temperature: number;
  first_message: string;
  system_prompt: string;
  variables: PromptVariable[];
  status: "draft" | "active" | "archived";
  version: number;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

const VOICE_OPTIONS: Record<string, { label: string; voices: { id: string; label: string }[] }> = {
  cartesia: {
    label: "Cartesia Indian (Hindi/English)",
    voices: [
      { id: "4877b818-c7fe-4c89-b1cf-eadf8e23da72", label: "Rohan — Hindi Male (Default)" },
      { id: "0f14d8cb-f039-41fe-a813-a9b4bee7eed8", label: "Hindi Female" },
    ],
  },
  openai: {
    label: "OpenAI (Multilingual)",
    voices: [
      { id: "shimmer", label: "Shimmer — Female" },
      { id: "nova", label: "Nova — Female" },
      { id: "alloy", label: "Alloy — Neutral" },
      { id: "echo", label: "Echo — Male" },
      { id: "onyx", label: "Onyx — Male" },
    ],
  },
  deepgram: {
    label: "Deepgram (English Only)",
    voices: [
      { id: "aura-asteria-en", label: "Asteria — Female" },
      { id: "aura-orion-en", label: "Orion — Male" },
    ],
  },
  elevenlabs: {
    label: "ElevenLabs",
    voices: [
      { id: "RABOvaPec1ymXz02oDQi", label: "Indian Voice 1" },
      { id: "czQ9pLzjRaF61EAYjcPC", label: "Indian Voice 2" },
    ],
  },
};

const LANGUAGES = [
  { value: "multi", label: "Auto-Detect (Multilingual)" },
  { value: "hi", label: "Hindi" },
  { value: "en", label: "English" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "bn", label: "Bengali" },
  { value: "mr", label: "Marathi" },
  { value: "gu", label: "Gujarati" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "pa", label: "Punjabi" },
];

type EditorState = Omit<Agent, "id" | "group_id" | "status" | "version" | "is_current" | "created_at" | "updated_at"> & {
  id: string | null;
};

const blankEditor = (useCase = "custom"): EditorState => {
  const template = getTemplate(useCase);
  return {
    id: null,
    name: "",
    use_case: useCase,
    language: "multi",
    voice_provider: "cartesia",
    voice_id: "4877b818-c7fe-4c89-b1cf-eadf8e23da72",
    llm_provider: "openai",
    temperature: 0.5,
    first_message: template.first_message,
    system_prompt: template.system_prompt,
    variables: mergeVariables([], extractVariableNames(template.system_prompt + " " + template.first_message)),
  };
};

export default function AgentBuilder() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: boolean; system_prompt?: boolean }>({});
  const [versionsFor, setVersionsFor] = useState<Agent | null>(null);
  const [versions, setVersions] = useState<Agent[]>([]);
  const [testTarget, setTestTarget] = useState<Agent | null>(null);
  const [testVariableValues, setTestVariableValues] = useState<Record<string, string>>({});
  const [kbTarget, setKbTarget] = useState<Agent | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (data.success) setAgents(data.agents ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const openCreate = () => {
    setFieldErrors({});
    setSaveError("");
    setEditor(blankEditor());
  };

  const openEdit = (agent: Agent) => {
    setFieldErrors({});
    setSaveError("");
    setEditor({
      id: agent.id,
      name: agent.name,
      use_case: agent.use_case,
      language: agent.language,
      voice_provider: agent.voice_provider,
      voice_id: agent.voice_id,
      llm_provider: agent.llm_provider,
      temperature: agent.temperature,
      first_message: agent.first_message,
      system_prompt: agent.system_prompt,
      variables: agent.variables ?? [],
    });
  };

  const applyTemplate = (useCaseId: string) => {
    if (!editor) return;
    const template = getTemplate(useCaseId);
    const names = extractVariableNames(template.system_prompt + " " + template.first_message);
    setEditor({
      ...editor,
      use_case: useCaseId,
      first_message: template.first_message,
      system_prompt: template.system_prompt,
      variables: mergeVariables(editor.variables, names),
    });
  };

  const updatePromptField = (field: "system_prompt" | "first_message", value: string) => {
    if (!editor) return;
    const next = { ...editor, [field]: value };
    const names = extractVariableNames(next.system_prompt + " " + next.first_message);
    next.variables = mergeVariables(editor.variables, names);
    setEditor(next);
  };

  const updateVariableDefault = (name: string, value: string) => {
    if (!editor) return;
    setEditor({
      ...editor,
      variables: editor.variables.map((v) => (v.name === name ? { ...v, default_value: value } : v)),
    });
  };

  const handleSave = async () => {
    if (!editor) return;
    const errors = {
      name: !editor.name.trim(),
      system_prompt: !editor.system_prompt.trim(),
    };
    if (errors.name || errors.system_prompt) {
      setFieldErrors(errors);
      setSaveError("Fill in the highlighted required field(s) below");
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setSaveError("");
    try {
      const url = editor.id ? `/api/agents/${editor.id}` : "/api/agents";
      const method = editor.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editor.name.trim(),
          use_case: editor.use_case,
          language: editor.language,
          voice_provider: editor.voice_provider,
          voice_id: editor.voice_id,
          llm_provider: editor.llm_provider,
          temperature: editor.temperature,
          first_message: editor.first_message.trim(),
          system_prompt: editor.system_prompt.trim(),
          variables: editor.variables,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setSaveError(data.error || "Failed to save agent");
        return;
      }
      setEditor(null);
      fetchAgents();
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (agent: Agent) => {
    await fetch(`/api/agents/${agent.id}/duplicate`, { method: "POST" });
    fetchAgents();
  };

  const handleArchiveToggle = async (agent: Agent) => {
    const nextStatus = agent.status === "archived" ? "active" : "archived";
    await fetch(`/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    fetchAgents();
  };

  const openVersions = async (agent: Agent) => {
    setVersionsFor(agent);
    const res = await fetch(`/api/agents/${agent.id}/versions`);
    const data = await res.json();
    if (data.success) setVersions(data.versions ?? []);
  };

  const handleRestoreVersion = async (version: number) => {
    if (!versionsFor) return;
    const res = await fetch(`/api/agents/${versionsFor.id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
    });
    const data = await res.json();
    if (data.success) {
      setVersionsFor(null);
      fetchAgents();
    }
  };

  const openTest = (agent: Agent) => {
    const defaults: Record<string, string> = {};
    (agent.variables ?? []).forEach((v) => (defaults[v.name] = v.default_value || ""));
    setTestVariableValues(defaults);
    setTestTarget(agent);
  };

  return (
    <div className="space-y-5">
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-400" />
          <h2 className="text-base font-semibold text-white">Agents</h2>
        </div>
        <button
          onClick={openCreate}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all duration-150 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Create Agent
        </button>
      </div>

      {loading ? (
        <div className="card text-center py-8 text-sm text-[var(--color-text-muted)]">Loading agents…</div>
      ) : agents.length === 0 ? (
        <div className="card text-center py-10 space-y-3">
          <p className="text-sm text-[var(--color-text-muted)]">No agents yet.</p>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all duration-150 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Create your first agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {getTemplate(agent.use_case).label} · v{agent.version}
                  </p>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    agent.status === "archived"
                      ? "bg-white/[0.06] text-[var(--color-text-muted)]"
                      : agent.status === "draft"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-green-500/10 text-green-400"
                  }`}
                >
                  {agent.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                <span className="px-2 py-0.5 rounded-full bg-white/[0.04]">
                  {LANGUAGES.find((l) => l.value === agent.language)?.label ?? agent.language}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/[0.04]">{agent.llm_provider}</span>
                <span className="px-2 py-0.5 rounded-full bg-white/[0.04]">temp {agent.temperature}</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => openTest(agent)} className="icon-action-btn" title="Test in browser">
                  <PhoneCall className="w-3.5 h-3.5" /> Test
                </button>
                <button onClick={() => setKbTarget(agent)} className="icon-action-btn" title="Knowledge base">
                  <BookOpen className="w-3.5 h-3.5" /> Knowledge
                </button>
                <button onClick={() => openEdit(agent)} className="icon-action-btn" title="Edit (creates new version)">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => handleDuplicate(agent)} className="icon-action-btn" title="Duplicate">
                  <Copy className="w-3.5 h-3.5" /> Duplicate
                </button>
                <button onClick={() => openVersions(agent)} className="icon-action-btn" title="Version history">
                  <History className="w-3.5 h-3.5" /> v{agent.version}
                </button>
                <button onClick={() => handleArchiveToggle(agent)} className="icon-action-btn" title="Archive">
                  {agent.status === "archived" ? (
                    <><ArchiveRestore className="w-3.5 h-3.5" /> Unarchive</>
                  ) : (
                    <><Archive className="w-3.5 h-3.5" /> Archive</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-2xl space-y-5 my-8 relative">
            <button
              onClick={() => setEditor(null)}
              className="absolute top-3 right-3 text-[var(--color-text-muted)] hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-base font-semibold text-white">{editor.id ? "Edit Agent" : "Create Agent"}</h2>

            {!editor.id && (
              <div>
                <label>Use-case Template</label>
                <div className="flex flex-wrap gap-2">
                  {AGENT_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                        editor.use_case === t.id
                          ? "bg-purple-600 text-white"
                          : "bg-white/[0.06] text-[var(--color-text-muted)] hover:bg-white/[0.1]"
                      }`}
                      title={t.description}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="agent-name">Agent Name</label>
              <input
                id="agent-name"
                type="text"
                placeholder="e.g. Appointment Reminder Bot"
                value={editor.name}
                onChange={(e) => {
                  setEditor({ ...editor, name: e.target.value });
                  if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: false });
                }}
                className={fieldErrors.name ? "!border-red-500" : ""}
              />
              {fieldErrors.name && <p className="text-[11px] text-red-400 mt-1">Agent name is required</p>}
            </div>

            <div>
              <label htmlFor="agent-first-message">First Message</label>
              <input
                id="agent-first-message"
                type="text"
                placeholder="What the agent says as soon as the call connects"
                value={editor.first_message}
                onChange={(e) => updatePromptField("first_message", e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="agent-prompt">System Prompt</label>
              <textarea
                id="agent-prompt"
                rows={8}
                value={editor.system_prompt}
                onChange={(e) => {
                  updatePromptField("system_prompt", e.target.value);
                  if (fieldErrors.system_prompt) setFieldErrors({ ...fieldErrors, system_prompt: false });
                }}
                className={fieldErrors.system_prompt ? "!border-red-500" : ""}
              />
              {fieldErrors.system_prompt && <p className="text-[11px] text-red-400 mt-1">System prompt is required</p>}
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                Use <code>{"{{variable_name}}"}</code> tokens for values filled in per call.
              </p>
            </div>

            {editor.variables.length > 0 && (
              <div>
                <label>Variables</label>
                <div className="space-y-2">
                  {editor.variables.map((v) => (
                    <div key={v.name} className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2 py-1.5 rounded-lg bg-white/[0.04] text-purple-300 whitespace-nowrap">
                        {"{{" + v.name + "}}"}
                      </span>
                      <input
                        type="text"
                        placeholder="Default value (optional)"
                        value={v.default_value}
                        onChange={(e) => updateVariableDefault(v.name, e.target.value)}
                        className="!py-1.5 !text-xs flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="agent-language">Language</label>
                <select
                  id="agent-language"
                  value={editor.language}
                  onChange={(e) => setEditor({ ...editor, language: e.target.value })}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="agent-llm">LLM Provider</label>
                <select
                  id="agent-llm"
                  value={editor.llm_provider}
                  onChange={(e) => setEditor({ ...editor, llm_provider: e.target.value })}
                >
                  <option value="openai">OpenAI (gpt-4o-mini)</option>
                  <option value="groq">Groq (llama-3.3-70b)</option>
                </select>
              </div>

              <div>
                <label htmlFor="agent-voice-provider">Voice Provider</label>
                <select
                  id="agent-voice-provider"
                  value={editor.voice_provider}
                  onChange={(e) => {
                    const provider = e.target.value;
                    setEditor({ ...editor, voice_provider: provider, voice_id: VOICE_OPTIONS[provider].voices[0].id });
                  }}
                >
                  {Object.entries(VOICE_OPTIONS).map(([key, v]) => (
                    <option key={key} value={key}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="agent-voice">Voice</label>
                <select
                  id="agent-voice"
                  value={editor.voice_id}
                  onChange={(e) => setEditor({ ...editor, voice_id: e.target.value })}
                >
                  {VOICE_OPTIONS[editor.voice_provider].voices.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="agent-temperature" className="mb-0">Temperature</label>
                <span className="text-[11px] text-[var(--color-text-muted)] font-mono">{editor.temperature.toFixed(2)}</span>
              </div>
              <input
                id="agent-temperature"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={editor.temperature}
                onChange={(e) => setEditor({ ...editor, temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                Lower = more consistent/scripted. Higher = more varied/creative.
              </p>
            </div>

            {saveError && <p className="text-xs text-red-400">{saveError}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-lg font-medium text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 flex items-center justify-center gap-2"
            >
              {saving ? (<><span className="spinner" /> Saving…</>) : editor.id ? "Save as New Version" : "Create Agent"}
            </button>
          </div>
        </div>
      )}

      {/* Version history modal */}
      {versionsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md space-y-4 relative">
            <button
              onClick={() => setVersionsFor(null)}
              className="absolute top-3 right-3 text-[var(--color-text-muted)] hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-base font-semibold text-white">Version History — {versionsFor.name}</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04]">
                  <div>
                    <p className="text-xs font-medium text-white">
                      v{v.version} {v.is_current && <span className="text-green-400">(current)</span>}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {new Date(v.updated_at).toLocaleString()}
                    </p>
                  </div>
                  {!v.is_current && (
                    <button
                      onClick={() => handleRestoreVersion(v.version)}
                      className="text-[11px] font-semibold text-purple-400 hover:text-purple-300"
                    >
                      Restore
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Test widget */}
      {testTarget && (
        <AgentTestWidget
          agentId={testTarget.id}
          agentName={testTarget.name}
          variableValues={testVariableValues}
          onClose={() => setTestTarget(null)}
        />
      )}

      {/* Knowledge base manager */}
      {kbTarget && (
        <KnowledgeBaseManager
          agentId={kbTarget.group_id}
          agentName={kbTarget.name}
          onClose={() => setKbTarget(null)}
        />
      )}
    </div>
  );
}
