"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bot,
  Plus,
  Copy,
  Archive,
  ArchiveRestore,
  History,
  PhoneCall,
  Pencil,
  BookOpen,
  Search,
  Sparkles,
  Undo2,
  Power,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { AGENT_TEMPLATES, getTemplate } from "@/lib/agentTemplates";
import { extractVariableNames, mergeVariables, type PromptVariable } from "@/lib/promptVariables";
import AgentTestWidget from "@/components/AgentTestWidget";
import KnowledgeBaseManager from "@/components/KnowledgeBaseManager";
import { Modal, ConfirmDialog, Pill, useToast, fmtDateTime, relTime } from "@/components/ai2-ui";

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
      { id: "1259b7e3-cb8a-43df-9446-30971a46b8b0", label: "English Male" },
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

const LLM_OPTIONS: Record<string, string> = {
  openai: "OpenAI (gpt-4o-mini)",
  groq: "Groq (llama-3.3-70b)",
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

const NAME_MAX = 80;
const PROMPT_SOFT_LIMIT = 6000;

const languageLabel = (value: string) => LANGUAGES.find((l) => l.value === value)?.label ?? value;
const voiceLabel = (provider: string, id: string) =>
  VOICE_OPTIONS[provider]?.voices.find((v) => v.id === id)?.label ?? id;

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

type StatusFilter = "all" | "active" | "draft" | "archived";
type SortKey = "updated" | "name" | "version";

type ConfirmState =
  | { kind: "discard-editor" }
  | { kind: "revert-editor" }
  | { kind: "archive"; agent: Agent }
  | null;

const STATUS_TONE = { active: "green", draft: "amber", archived: "gray" } as const;

export default function AgentBuilder() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; system_prompt?: string }>({});
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const [aiBrief, setAiBrief] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [promptBackup, setPromptBackup] = useState<string | null>(null);

  const [versionsFor, setVersionsFor] = useState<Agent | null>(null);
  const [versions, setVersions] = useState<Agent[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState("");
  const [restoring, setRestoring] = useState<number | null>(null);

  const [testTarget, setTestTarget] = useState<Agent | null>(null);
  const [testVariableValues, setTestVariableValues] = useState<Record<string, string>>({});
  const [testStarted, setTestStarted] = useState(false);
  const [kbTarget, setKbTarget] = useState<Agent | null>(null);

  const { push, node: toastNode } = useToast();

  const fetchAgents = useCallback(async () => {
    try {
      const [activeRes, archivedRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/agents?status=archived").catch(() => null),
      ]);
      const activeData = await activeRes.json();
      if (!activeData.success) throw new Error(activeData.error || "Failed to load agents");
      const archivedData = archivedRes ? await archivedRes.json().catch(() => null) : null;
      setAgents([
        ...(activeData.agents ?? []),
        ...(archivedData?.success ? archivedData.agents ?? [] : []),
      ]);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const counts = useMemo(() => {
    const c = { active: 0, draft: 0, archived: 0 };
    agents.forEach((a) => {
      c[a.status] += 1;
    });
    return c;
  }, [agents]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = agents.filter((a) => (statusFilter === "all" ? a.status !== "archived" : a.status === statusFilter));
    if (q) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          getTemplate(a.use_case).label.toLowerCase().includes(q) ||
          languageLabel(a.language).toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name, "en-IN");
      if (sortKey === "version") return b.version - a.version;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [agents, query, statusFilter, sortKey]);

  const dirty = editor !== null && JSON.stringify(editor) !== snapshot;

  const openEditorWith = (state: EditorState) => {
    setFieldErrors({});
    setSaveError("");
    setAiBrief("");
    setAiError("");
    setPromptBackup(null);
    setSnapshot(JSON.stringify(state));
    setEditor(state);
  };

  const openCreate = () => openEditorWith(blankEditor());

  const openEdit = (agent: Agent) =>
    openEditorWith({
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

  const requestCloseEditor = () => {
    if (saving) return;
    if (dirty) setConfirm({ kind: "discard-editor" });
    else setEditor(null);
  };

  const patchEditor = (patch: Partial<EditorState>) => setEditor((prev) => (prev ? { ...prev, ...patch } : prev));

  const applyTemplate = (useCaseId: string) => {
    const template = getTemplate(useCaseId);
    const names = extractVariableNames(template.system_prompt + " " + template.first_message);
    setEditor((prev) =>
      prev
        ? {
            ...prev,
            use_case: useCaseId,
            first_message: template.first_message,
            system_prompt: template.system_prompt,
            variables: mergeVariables(prev.variables, names),
          }
        : prev
    );
    setPromptBackup(null);
    setFieldErrors((f) => ({ ...f, system_prompt: undefined }));
  };

  const updatePromptField = (field: "system_prompt" | "first_message", value: string) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      next.variables = mergeVariables(prev.variables, extractVariableNames(next.system_prompt + " " + next.first_message));
      return next;
    });
  };

  const updateVariableDefault = (name: string, value: string) => {
    setEditor((prev) =>
      prev ? { ...prev, variables: prev.variables.map((v) => (v.name === name ? { ...v, default_value: value } : v)) } : prev
    );
  };

  const handleGenerate = async () => {
    if (!editor) return;
    if (aiBrief.trim().length < 3) {
      setAiError("Describe the call in a few words, e.g. “Appointment reminder in Hindi for a dental clinic”.");
      return;
    }
    setAiBusy(true);
    setAiError("");
    try {
      const res = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: aiBrief.trim() }),
      });
      const data = await res.json();
      if (!data.success || !data.prompt) {
        setAiError(data.error || "Could not generate a prompt. Try again.");
        return;
      }
      setPromptBackup(editor.system_prompt);
      updatePromptField("system_prompt", data.prompt);
      setFieldErrors((f) => ({ ...f, system_prompt: undefined }));
      push("Prompt generated — review it before saving", "info");
    } catch {
      setAiError("Network error. Please try again.");
    } finally {
      setAiBusy(false);
    }
  };

  const undoGenerated = () => {
    if (promptBackup === null) return;
    updatePromptField("system_prompt", promptBackup);
    setPromptBackup(null);
  };

  const handleSave = async () => {
    if (!editor) return;
    const errors: { name?: string; system_prompt?: string } = {};
    if (!editor.name.trim()) errors.name = "Agent name is required";
    else if (editor.name.trim().length > NAME_MAX) errors.name = `Keep the name under ${NAME_MAX} characters`;
    if (!editor.system_prompt.trim()) errors.system_prompt = "Instructions are required";
    if (errors.name || errors.system_prompt) {
      setFieldErrors(errors);
      setSaveError("Fix the highlighted field(s) before saving");
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
      push(editor.id ? `Saved as version ${data.agent?.version ?? ""}`.trim() : "Agent created");
      fetchAgents();
    } catch {
      setSaveError("Network error. Your changes are still here — try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (agent: Agent) => {
    setBusyId(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not duplicate agent");
      push(`Created “${data.agent?.name ?? agent.name + " (Copy)"}” as a draft`);
      fetchAgents();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not duplicate agent", "error");
    } finally {
      setBusyId(null);
    }
  };

  const setAgentStatus = async (agent: Agent, status: Agent["status"], message: string) => {
    setBusyId(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not update agent");
      push(message);
      await fetchAgents();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not update agent", "error");
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  const openVersions = async (agent: Agent) => {
    setVersionsFor(agent);
    setVersions([]);
    setVersionsError("");
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/versions`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not load version history");
      setVersions(data.versions ?? []);
    } catch (err) {
      setVersionsError(err instanceof Error ? err.message : "Could not load version history");
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleRestoreVersion = async (version: number) => {
    if (!versionsFor) return;
    setRestoring(version);
    try {
      const res = await fetch(`/api/agents/${versionsFor.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not restore version");
      push(`Version ${version} is now live`);
      setVersionsFor(null);
      fetchAgents();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not restore version", "error");
    } finally {
      setRestoring(null);
    }
  };

  const openTest = (agent: Agent) => {
    const defaults: Record<string, string> = {};
    (agent.variables ?? []).forEach((v) => (defaults[v.name] = v.default_value || ""));
    setTestVariableValues(defaults);
    setTestStarted((agent.variables ?? []).length === 0);
    setTestTarget(agent);
  };

  const closeTest = () => {
    setTestTarget(null);
    setTestStarted(false);
  };

  const editorAgent = editor?.id ? agents.find((a) => a.id === editor.id) ?? null : null;
  const promptLength = editor?.system_prompt.length ?? 0;
  const promptWords = editor?.system_prompt.trim() ? editor.system_prompt.trim().split(/\s+/).length : 0;
  const filtersActive = query.trim() !== "" || statusFilter !== "all";

  return (
    <div className="ai2 ai2-page">
      <div className="ai2-kpis">
        <div className="ai2-kpi">
          <span className="ai2-kpi-label">Agents</span>
          <span className="ai2-kpi-value">{counts.active + counts.draft}</span>
          <span className="ai2-kpi-sub">excluding archived</span>
        </div>
        <div className="ai2-kpi">
          <span className="ai2-kpi-label">Active</span>
          <span className="ai2-kpi-value">{counts.active}</span>
          <span className="ai2-kpi-sub">ready for calls</span>
        </div>
        <div className="ai2-kpi">
          <span className="ai2-kpi-label">Drafts</span>
          <span className="ai2-kpi-value">{counts.draft}</span>
          <span className="ai2-kpi-sub">not yet activated</span>
        </div>
        <div className="ai2-kpi">
          <span className="ai2-kpi-label">Archived</span>
          <span className="ai2-kpi-value">{counts.archived}</span>
          <span className="ai2-kpi-sub">restorable anytime</span>
        </div>
      </div>

      <section className="ai2-panel">
        <div className="ai2-panel-head">
          <div className="ai2-panel-title">
            <span className="ai2-panel-icon"><Bot /></span>
            <div>
              <h2>Agents</h2>
              <p>Design the voice, behaviour and knowledge of each AI caller.</p>
            </div>
          </div>
          <button type="button" className="ai2-btn ai2-btn-primary" onClick={openCreate}>
            <Plus /> Create agent
          </button>
        </div>

        <div className="ai2-toolbar">
          <label className="ai2-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Search agents by name, use case or language"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search agents"
            />
          </label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label="Filter by status">
            <option value="all">All (excl. archived)</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort agents">
            <option value="updated">Recently updated</option>
            <option value="name">Name (A–Z)</option>
            <option value="version">Most versions</option>
          </select>
          <span className="ai2-count">{visible.length} agent{visible.length === 1 ? "" : "s"}</span>
        </div>

        <div className="ai2-panel-body">
          {loading ? (
            <div className="ai2-agent-grid" aria-busy="true" aria-label="Loading agents">
              {[0, 1, 2].map((i) => (
                <div key={i} className="ai2-skeleton ai2-skeleton-card" />
              ))}
            </div>
          ) : loadError ? (
            <div className="ai2-empty">
              <span className="ai2-empty-icon ai2-empty-icon-warn"><TriangleAlert /></span>
              <h3>Couldn’t load your agents</h3>
              <p>{loadError}</p>
              <button type="button" className="ai2-btn" onClick={() => { setLoading(true); fetchAgents(); }}>
                <RefreshCw /> Retry
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="ai2-empty">
              <span className="ai2-empty-icon"><Bot /></span>
              {filtersActive ? (
                <>
                  <h3>No agents match your filters</h3>
                  <p>Try a different search term or status.</p>
                  <button type="button" className="ai2-btn" onClick={() => { setQuery(""); setStatusFilter("all"); }}>
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <h3>Create your first agent</h3>
                  <p>Pick a use-case template, choose a voice and start testing in your browser within minutes.</p>
                  <button type="button" className="ai2-btn ai2-btn-primary" onClick={openCreate}>
                    <Plus /> Create agent
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="ai2-agent-grid">
              {visible.map((agent) => {
                const archived = agent.status === "archived";
                const busy = busyId === agent.id;
                return (
                  <article key={agent.id} className={`ai2-agent${archived ? " is-archived" : ""}`}>
                    <header className="ai2-agent-head">
                      <span className="ai2-agent-avatar"><Bot /></span>
                      <div className="ai2-agent-title">
                        <h3 title={agent.name}>{agent.name}</h3>
                        <p>{getTemplate(agent.use_case).label}</p>
                      </div>
                      <Pill tone={STATUS_TONE[agent.status]} dot>{agent.status}</Pill>
                    </header>

                    <div className="ai2-chips">
                      <span className="ai2-chip">{languageLabel(agent.language)}</span>
                      <span className="ai2-chip" title={VOICE_OPTIONS[agent.voice_provider]?.label}>
                        {voiceLabel(agent.voice_provider, agent.voice_id)}
                      </span>
                      <span className="ai2-chip">{LLM_OPTIONS[agent.llm_provider] ?? agent.llm_provider}</span>
                      <span className="ai2-chip">Temp {Number(agent.temperature).toFixed(2)}</span>
                    </div>

                    <p className="ai2-agent-greeting">
                      {agent.first_message ? <>“{agent.first_message}”</> : <em>No first message set</em>}
                    </p>

                    <footer className="ai2-agent-foot">
                      <span className="ai2-agent-meta" title={fmtDateTime(agent.updated_at)}>
                        Version {agent.version} · Updated {relTime(agent.updated_at)}
                      </span>
                      <div className="ai2-agent-actions">
                        {!archived && (
                          <>
                            <button type="button" className="ai2-btn ai2-btn-sm ai2-btn-primary" onClick={() => openTest(agent)} disabled={busy}>
                              <PhoneCall /> Test
                            </button>
                            <button type="button" className="ai2-btn ai2-btn-sm" onClick={() => openEdit(agent)} disabled={busy} title="Editing saves a new version">
                              <Pencil /> Edit
                            </button>
                            <button type="button" className="ai2-btn ai2-btn-sm" onClick={() => setKbTarget(agent)} disabled={busy}>
                              <BookOpen /> Knowledge
                            </button>
                          </>
                        )}
                        {agent.status === "draft" && (
                          <button
                            type="button"
                            className="ai2-icon-btn"
                            aria-label={`Activate ${agent.name}`}
                            title="Mark as active"
                            disabled={busy}
                            onClick={() => setAgentStatus(agent, "active", `${agent.name} is now active`)}
                          >
                            <Power />
                          </button>
                        )}
                        <button type="button" className="ai2-icon-btn" aria-label={`Duplicate ${agent.name}`} title="Duplicate" disabled={busy} onClick={() => handleDuplicate(agent)}>
                          <Copy />
                        </button>
                        <button type="button" className="ai2-icon-btn" aria-label={`Version history for ${agent.name}`} title="Version history" onClick={() => openVersions(agent)}>
                          <History />
                        </button>
                        {archived ? (
                          <button
                            type="button"
                            className="ai2-icon-btn"
                            aria-label={`Restore ${agent.name}`}
                            title="Restore"
                            disabled={busy}
                            onClick={() => setAgentStatus(agent, "active", `${agent.name} restored`)}
                          >
                            <ArchiveRestore />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ai2-icon-btn ai2-icon-btn-danger"
                            aria-label={`Archive ${agent.name}`}
                            title="Archive"
                            disabled={busy}
                            onClick={() => setConfirm({ kind: "archive", agent })}
                          >
                            <Archive />
                          </button>
                        )}
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {editor && (
        <Modal
          size="lg"
          title={editor.id ? `Edit ${editor.name || "agent"}` : "Create agent"}
          subtitle={editor.id ? "Saving creates a new version; earlier versions stay restorable." : "Start from a template and tailor it to your call."}
          icon={<Bot />}
          onClose={requestCloseEditor}
          dismissOnBackdrop={false}
          footer={
            <>
              <span className={`ai2-dirty${dirty ? " is-dirty" : ""}`} role="status">
                <i aria-hidden="true" />
                {saveError ? <span className="ai2-text-danger">{saveError}</span> : dirty ? "Unsaved changes" : "No unsaved changes"}
              </span>
              <button
                type="button"
                className="ai2-btn"
                onClick={() => setConfirm({ kind: "revert-editor" })}
                disabled={!dirty || saving}
              >
                <Undo2 /> Discard
              </button>
              <button type="button" className="ai2-btn ai2-btn-primary" onClick={handleSave} disabled={saving || (!!editor.id && !dirty)}>
                {saving && <span className="ai2-spin" aria-hidden="true" />}
                {saving ? "Saving…" : editor.id ? "Save as new version" : "Create agent"}
              </button>
            </>
          }
        >
          <div className="ai2-form-sections">
            <section className="ai2-fs">
              <header><span>1</span><div><h3>Identity</h3><p>Who the agent is and how it opens the call.</p></div></header>
              {!editor.id && (
                <div className="ai2-field">
                  <label>Use-case template</label>
                  <div className="ai2-segment" role="group" aria-label="Use-case template">
                    {AGENT_TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={editor.use_case === t.id ? "is-on" : ""}
                        aria-pressed={editor.use_case === t.id}
                        onClick={() => applyTemplate(t.id)}
                        title={t.description}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <p className="ai2-hint">Applying a template replaces the first message and instructions.</p>
                </div>
              )}
              <div className="ai2-field">
                <label htmlFor="agent-name">Agent name</label>
                <input
                  id="agent-name"
                  type="text"
                  maxLength={NAME_MAX + 20}
                  placeholder="e.g. Appointment Reminder Bot"
                  value={editor.name}
                  onChange={(e) => {
                    patchEditor({ name: e.target.value });
                    if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }));
                  }}
                  className={fieldErrors.name ? "is-invalid" : ""}
                  aria-invalid={!!fieldErrors.name}
                  data-autofocus
                />
                {fieldErrors.name && <p className="ai2-error">{fieldErrors.name}</p>}
              </div>
              <div className="ai2-field">
                <label htmlFor="agent-first-message">First message</label>
                <input
                  id="agent-first-message"
                  type="text"
                  placeholder="What the agent says as soon as the call connects"
                  value={editor.first_message}
                  onChange={(e) => updatePromptField("first_message", e.target.value)}
                />
              </div>
            </section>

            <section className="ai2-fs">
              <header><span>2</span><div><h3>Voice &amp; model</h3><p>Language, speech provider and how creative the agent can be.</p></div></header>
              <div className="ai2-grid-2">
                <div className="ai2-field">
                  <label htmlFor="agent-language">Language</label>
                  <select id="agent-language" value={editor.language} onChange={(e) => patchEditor({ language: e.target.value })}>
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div className="ai2-field">
                  <label htmlFor="agent-llm">LLM provider</label>
                  <select id="agent-llm" value={editor.llm_provider} onChange={(e) => patchEditor({ llm_provider: e.target.value })}>
                    {Object.entries(LLM_OPTIONS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="ai2-field">
                  <label htmlFor="agent-voice-provider">Voice provider</label>
                  <select
                    id="agent-voice-provider"
                    value={editor.voice_provider}
                    onChange={(e) => {
                      const provider = e.target.value;
                      patchEditor({ voice_provider: provider, voice_id: VOICE_OPTIONS[provider].voices[0].id });
                    }}
                  >
                    {Object.entries(VOICE_OPTIONS).map(([key, v]) => (
                      <option key={key} value={key}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="ai2-field">
                  <label htmlFor="agent-voice">Voice</label>
                  <select id="agent-voice" value={editor.voice_id} onChange={(e) => patchEditor({ voice_id: e.target.value })}>
                    {(VOICE_OPTIONS[editor.voice_provider]?.voices ?? []).map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="ai2-field">
                <div className="ai2-label-row">
                  <label htmlFor="agent-temperature">Temperature</label>
                  <span className="ai2-mono">{editor.temperature.toFixed(2)}</span>
                </div>
                <input
                  id="agent-temperature"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={editor.temperature}
                  onChange={(e) => patchEditor({ temperature: parseFloat(e.target.value) })}
                />
                <p className="ai2-hint">Lower = more consistent and scripted. Higher = more varied and creative.</p>
              </div>
            </section>

            <section className="ai2-fs">
              <header><span>3</span><div><h3>Instructions</h3><p>The system prompt that defines behaviour, flow and guardrails.</p></div></header>
              <div className="ai2-ai-box">
                <div className="ai2-ai-row">
                  <Sparkles aria-hidden="true" />
                  <input
                    type="text"
                    value={aiBrief}
                    onChange={(e) => { setAiBrief(e.target.value); setAiError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGenerate(); } }}
                    placeholder="Describe the call, e.g. “Car sales follow-up in Hindi from ABC Motors”"
                    aria-label="Describe the call to generate a prompt"
                  />
                  <button type="button" className="ai2-btn ai2-btn-sm ai2-btn-primary" onClick={handleGenerate} disabled={aiBusy}>
                    {aiBusy ? <span className="ai2-spin" aria-hidden="true" /> : <Sparkles />}
                    {aiBusy ? "Generating…" : "Generate with AI"}
                  </button>
                </div>
                {aiError && <p className="ai2-error">{aiError}</p>}
                {promptBackup !== null && (
                  <button type="button" className="ai2-link" onClick={undoGenerated}>
                    <Undo2 /> Undo AI draft and restore previous instructions
                  </button>
                )}
              </div>
              <div className="ai2-field">
                <label htmlFor="agent-prompt">System prompt</label>
                <textarea
                  id="agent-prompt"
                  rows={12}
                  value={editor.system_prompt}
                  onChange={(e) => {
                    updatePromptField("system_prompt", e.target.value);
                    if (fieldErrors.system_prompt) setFieldErrors((f) => ({ ...f, system_prompt: undefined }));
                  }}
                  className={fieldErrors.system_prompt ? "is-invalid" : ""}
                  aria-invalid={!!fieldErrors.system_prompt}
                />
                <div className="ai2-counter-row">
                  <span>
                    {fieldErrors.system_prompt ? (
                      <span className="ai2-error">{fieldErrors.system_prompt}</span>
                    ) : (
                      <>Use <code>{"{{variable_name}}"}</code> tokens for values filled in per call.</>
                    )}
                  </span>
                  <span className={`ai2-counter${promptLength > PROMPT_SOFT_LIMIT ? " is-warn" : ""}`}>
                    {promptLength.toLocaleString("en-IN")} chars · {promptWords.toLocaleString("en-IN")} words
                  </span>
                </div>
                {promptLength > PROMPT_SOFT_LIMIT && (
                  <p className="ai2-hint ai2-hint-warn">Very long prompts can slow down replies. Consider moving reference material into the knowledge base.</p>
                )}
              </div>

              {editor.variables.length > 0 && (
                <div className="ai2-field">
                  <label>Variables detected</label>
                  <div className="ai2-var-list">
                    {editor.variables.map((v) => (
                      <div key={v.name} className="ai2-var-row">
                        <code>{"{{" + v.name + "}}"}</code>
                        <input
                          type="text"
                          placeholder="Default value (optional)"
                          value={v.default_value}
                          onChange={(e) => updateVariableDefault(v.name, e.target.value)}
                          aria-label={`Default value for ${v.name}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="ai2-fs">
              <header><span>4</span><div><h3>Knowledge base</h3><p>Documents the agent can reference to answer questions.</p></div></header>
              {editorAgent ? (
                <div className="ai2-inline-action">
                  <p>Upload PDFs, DOCX, text files or web pages for this agent.</p>
                  <button type="button" className="ai2-btn ai2-btn-sm" onClick={() => setKbTarget(editorAgent)}>
                    <BookOpen /> Manage knowledge
                  </button>
                </div>
              ) : (
                <p className="ai2-hint">Save the agent first, then attach documents from here or from the agent card.</p>
              )}
            </section>

            <section className="ai2-fs">
              <header><span>5</span><div><h3>Test</h3><p>Talk to the agent in your browser — no phone number needed.</p></div></header>
              {editorAgent ? (
                <div className="ai2-inline-action">
                  <p>{dirty ? "Tests run against the last saved version. Save your changes to test them." : "Start a live call with the saved version."}</p>
                  <button type="button" className="ai2-btn ai2-btn-sm ai2-btn-primary" onClick={() => openTest(editorAgent)}>
                    <PhoneCall /> Test agent
                  </button>
                </div>
              ) : (
                <p className="ai2-hint">Create the agent to start a test call.</p>
              )}
            </section>
          </div>
        </Modal>
      )}

      {versionsFor && (
        <Modal
          title="Version history"
          subtitle={versionsFor.name}
          icon={<History />}
          onClose={() => setVersionsFor(null)}
        >
          {versionsLoading ? (
            <div className="ai2-stack" aria-busy="true">
              {[0, 1, 2].map((i) => <div key={i} className="ai2-skeleton ai2-skeleton-row" />)}
            </div>
          ) : versionsError ? (
            <p className="ai2-error">{versionsError}</p>
          ) : versions.length === 0 ? (
            <p className="ai2-hint">No versions found.</p>
          ) : (
            <ul className="ai2-version-list">
              {versions.map((v) => (
                <li key={v.id} className={v.is_current ? "is-current" : ""}>
                  <div className="ai2-version-main">
                    <div className="ai2-version-top">
                      <strong>Version {v.version}</strong>
                      {v.is_current && <Pill tone="green" dot>Current</Pill>}
                    </div>
                    <span className="ai2-muted">{fmtDateTime(v.created_at)}</span>
                    <p className="ai2-version-excerpt">{v.system_prompt.slice(0, 110)}{v.system_prompt.length > 110 ? "…" : ""}</p>
                  </div>
                  {!v.is_current && (
                    <button
                      type="button"
                      className="ai2-btn ai2-btn-sm"
                      onClick={() => handleRestoreVersion(v.version)}
                      disabled={restoring !== null}
                    >
                      {restoring === v.version ? <span className="ai2-spin" aria-hidden="true" /> : <Undo2 />} Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {testTarget && !testStarted && (
        <Modal
          size="sm"
          title="Test variables"
          subtitle={testTarget.name}
          icon={<PhoneCall />}
          onClose={closeTest}
          footer={
            <>
              <button type="button" className="ai2-btn" onClick={closeTest}>Cancel</button>
              <button type="button" className="ai2-btn ai2-btn-primary" onClick={() => setTestStarted(true)}>
                <PhoneCall /> Continue
              </button>
            </>
          }
        >
          <p className="ai2-hint ai2-mb">Fill in the values the agent will see during this test. Blank values keep the {"{{token}}"} as written.</p>
          <div className="ai2-stack">
            {(testTarget.variables ?? []).map((v, i) => (
              <div key={v.name} className="ai2-field">
                <label htmlFor={`test-var-${v.name}`}>{v.name}</label>
                <input
                  id={`test-var-${v.name}`}
                  type="text"
                  value={testVariableValues[v.name] ?? ""}
                  onChange={(e) => setTestVariableValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                  data-autofocus={i === 0 ? true : undefined}
                />
              </div>
            ))}
          </div>
        </Modal>
      )}

      {testTarget && testStarted && (
        <AgentTestWidget
          agentId={testTarget.id}
          agentName={testTarget.name}
          variableValues={testVariableValues}
          onClose={closeTest}
        />
      )}

      {kbTarget && (
        <KnowledgeBaseManager
          agentId={kbTarget.group_id}
          agentName={kbTarget.name}
          onClose={() => setKbTarget(null)}
        />
      )}

      {confirm?.kind === "discard-editor" && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          message="You have edits that haven’t been saved. Closing now will lose them."
          confirmLabel="Discard and close"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); setEditor(null); }}
        />
      )}
      {confirm?.kind === "revert-editor" && (
        <ConfirmDialog
          title="Discard all changes?"
          message="The form will go back to how it was when you opened it."
          confirmLabel="Discard changes"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setEditor(JSON.parse(snapshot) as EditorState);
            setFieldErrors({});
            setSaveError("");
            setPromptBackup(null);
            setConfirm(null);
            push("Changes discarded", "info");
          }}
        />
      )}
      {confirm?.kind === "archive" && (
        <ConfirmDialog
          title={`Archive “${confirm.agent.name}”?`}
          message="The agent and all its versions will be hidden from your active list. You can restore it any time from the Archived filter."
          confirmLabel="Archive agent"
          busy={busyId === confirm.agent.id}
          onCancel={() => setConfirm(null)}
          onConfirm={() => setAgentStatus(confirm.agent, "archived", `${confirm.agent.name} archived`)}
        />
      )}

      {toastNode}
    </div>
  );
}
