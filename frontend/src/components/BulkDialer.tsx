"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ReactNode, DragEvent } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  FileSpreadsheet,
  ClipboardList,
  Search,
  Trash2,
  Star,
  Sparkles,
  RefreshCw,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleAlert,
  TriangleAlert,
  Info,
  Rocket,
  Square,
  X,
  Download,
} from "lucide-react";
import { substituteVariables, extractVariableNames, type PromptVariable } from "@/lib/promptVariables";
import {
  parseContactWorkbook,
  detectPhoneColumnIndex,
  detectNameColumnIndex,
  extractPhoneNumbers,
  normalizePhoneNumber,
  type ExtractResult,
} from "@/lib/phoneListParser";
import "@/styles/calls.css";

interface DialResult {
  phone: string;
  status: "dispatched" | "failed";
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

interface SavedSheet {
  id: string;
  label: string;
  sheet_url: string;
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

type ContactState = "valid" | "duplicate" | "invalid";
type RunStatus = "queued" | "ringing" | "in-progress" | "completed" | "no-answer" | "failed" | "not-sent";
type ConfirmState =
  | null
  | { kind: "launch" }
  | { kind: "autocall" }
  | { kind: "clear" }
  | { kind: "script"; item: SavedPrompt }
  | { kind: "sheet"; item: SavedSheet };

interface ContactRow {
  index: number;
  raw: string;
  normalized: string | null;
  state: ContactState;
  name?: string;
}

const GROUP_SIZE = 5;
const GROUP_WAIT_MS = 60_000;
const GROUP_POLL_MS = 2000;
const PAGE_SIZE = 10;
const STEPS = ["Source", "Review contacts", "Configure", "Run & monitor"] as const;

const LANGUAGES: [string, string][] = [
  ["multi", "Auto-detect (multilingual)"], ["hi", "Hindi"], ["en", "English"], ["ta", "Tamil"], ["te", "Telugu"],
  ["bn", "Bengali"], ["mr", "Marathi"], ["gu", "Gujarati"], ["kn", "Kannada"], ["ml", "Malayalam"], ["pa", "Punjabi"],
];

const VOICE_GROUPS: { label: string; options: [string, string][] }[] = [
  {
    label: "Cartesia Indian (Hindi/English — recommended)",
    options: [
      ["4877b818-c7fe-4c89-b1cf-eadf8e23da72", "Rohan — Hindi male (default)"],
      ["0f14d8cb-f039-41fe-a813-a9b4bee7eed8", "Hindi female"],
      ["1259b7e3-cb8a-43df-9446-30971a46b8b0", "English voice"],
    ],
  },
  {
    label: "OpenAI (multilingual)",
    options: [["shimmer", "Shimmer — female"], ["nova", "Nova — female"], ["alloy", "Alloy — neutral"], ["echo", "Echo — male"], ["onyx", "Onyx — male"]],
  },
  { label: "Deepgram (English only)", options: [["aura-asteria-en", "Asteria — female"], ["aura-orion-en", "Orion — male"]] },
  { label: "ElevenLabs", options: [["RABOvaPec1ymXz02oDQi", "Indian voice 1"], ["czQ9pLzjRaF61EAYjcPC", "Indian voice 2"]] },
];

const RUN_STATUS_META: Record<RunStatus, { label: string; tone: string }> = {
  queued: { label: "Queued", tone: "muted" },
  ringing: { label: "Ringing", tone: "warn" },
  "in-progress": { label: "In progress", tone: "info" },
  completed: { label: "Completed", tone: "ok" },
  "no-answer": { label: "No answer", tone: "orange" },
  failed: { label: "Failed", tone: "danger" },
  "not-sent": { label: "Not sent", tone: "muted" },
};

const CONTACT_STATE_META: Record<ContactState, { label: string; tone: string }> = {
  valid: { label: "Ready", tone: "ok" },
  duplicate: { label: "Duplicate", tone: "warn" },
  invalid: { label: "Invalid", tone: "danger" },
};

const FINAL_CALL_STATUSES = new Set(["completed", "no-answer", "failed"]);

const fmt = (n: number) => n.toLocaleString("en-IN");

const voiceName = (id: string) => {
  for (const g of VOICE_GROUPS) {
    const hit = g.options.find(([value]) => value === id);
    if (hit) return hit[1].replace(" (default)", "");
  }
  return id;
};

const languageName = (code: string) => LANGUAGES.find(([c]) => c === code)?.[1] ?? code;

function runStatusFromCall(status: string | undefined): RunStatus {
  if (!status || status === "ringing" || status === "initiated") return "ringing";
  if (status === "connected") return "in-progress";
  if (status === "no-answer") return "no-answer";
  if (status === "failed") return "failed";
  return "completed";
}

function Pill({ tone, label }: { tone: string; label: string }) {
  return (
    <span className={`cl2-pill cl2-pill-${tone}`}>
      <span className="cl2-pill-dot" aria-hidden="true" />
      {label}
    </span>
  );
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

export default function BulkDialer() {
  const [step, setStep] = useState(1);
  const [numbers, setNumbers] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DialResult[]>([]);
  const [launchStatus, setLaunchStatus] = useState("");
  const [runError, setRunError] = useState("");
  const [stopRequested, setStopRequested] = useState(false);
  const [runPhones, setRunPhones] = useState<string[]>([]);
  const [roomStatus, setRoomStatus] = useState<Record<string, string>>({});
  const [batchInfo, setBatchInfo] = useState({ current: 0, total: 0 });
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [genError, setGenError] = useState("");
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [temperature, setTemperature] = useState<number | undefined>(undefined);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [modelProvider, setModelProvider] = useState("openai");
  const [voice, setVoice] = useState("4877b818-c7fe-4c89-b1cf-eadf8e23da72");
  const [language, setLanguage] = useState("multi");
  const [fileName, setFileName] = useState("");
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<string[][]>([]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<ExtractResult | null>(null);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [savedSheets, setSavedSheets] = useState<SavedSheet[]>([]);
  const [saveSheetLabel, setSaveSheetLabel] = useState("");
  const [showSaveSheetInput, setShowSaveSheetInput] = useState(false);
  const [savingSheet, setSavingSheet] = useState(false);
  const [showSavedSheetsList, setShowSavedSheetsList] = useState(false);
  const [autoCallEnabled, setAutoCallEnabled] = useState(false);
  const [autoCallStatus, setAutoCallStatus] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState<"all" | ContactState>("all");
  const [reviewPage, setReviewPage] = useState(1);
  const [monitorSearch, setMonitorSearch] = useState("");
  const [monitorFilter, setMonitorFilter] = useState<"all" | RunStatus>("all");
  const [monitorPage, setMonitorPage] = useState(1);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  // Latest-value refs so the 1-minute polling interval always uses current settings without resetting
  const calledNumbersRef = useRef<Set<string>>(new Set());
  const autoCallIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelLaunchRef = useRef(false);
  const sheetUrlRef = useRef(sheetUrl);
  const contextRef = useRef(context);
  const firstMessageRef = useRef(firstMessage);
  const selectedAgentRef = useRef(selectedAgent);
  const temperatureRef = useRef(temperature);
  const variableValuesRef = useRef(variableValues);
  const modelProviderRef = useRef(modelProvider);
  const voiceRef = useRef(voice);
  const languageRef = useRef(language);
  const contactNamesRef = useRef(contactNames);

  useEffect(() => {
    sheetUrlRef.current = sheetUrl;
    contextRef.current = context;
    firstMessageRef.current = firstMessage;
    selectedAgentRef.current = selectedAgent;
    temperatureRef.current = temperature;
    variableValuesRef.current = variableValues;
    modelProviderRef.current = modelProvider;
    voiceRef.current = voice;
    languageRef.current = language;
    contactNamesRef.current = contactNames;
  });

  useEffect(() => {
    return () => {
      if (autoCallIntervalRef.current) clearInterval(autoCallIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // Batches are paced from this browser tab, so warn before it is closed mid-run
  useEffect(() => {
    if (!loading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [loading]);

  const fetchSavedSheets = useCallback(async () => {
    try {
      const res = await fetch("/api/sheets/saved");
      const data = await res.json();
      if (data.success) setSavedSheets(data.sheets ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchSavedSheets(); }, [fetchSavedSheets]);

  const handleSaveSheet = async () => {
    const url = sheetUrl.trim();
    if (!url || !saveSheetLabel.trim()) return;
    setSavingSheet(true);
    try {
      const res = await fetch("/api/sheets/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: saveSheetLabel.trim(), sheet_url: url }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSaveSheetInput(false);
        setSaveSheetLabel("");
        fetchSavedSheets();
        setToast({ kind: "success", text: "Sheet saved" });
      } else {
        setToast({ kind: "error", text: data.error || "Could not save the sheet" });
      }
    } catch {
      setToast({ kind: "error", text: "Network error — sheet not saved" });
    } finally { setSavingSheet(false); }
  };

  const handleDeleteSheet = async (id: string) => {
    try {
      const res = await fetch(`/api/sheets/saved?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSavedSheets((prev) => prev.filter((s) => s.id !== id));
      setToast({ kind: "success", text: "Sheet removed" });
    } catch {
      setToast({ kind: "error", text: "Could not remove the sheet" });
    }
  };

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
    setContext(agent.system_prompt);
    setFirstMessage(agent.first_message);
    setTemperature(agent.temperature);
    setLanguage(agent.language);
    setVoice(agent.voice_id);
    setModelProvider(agent.llm_provider);
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
    if (!saveTitle.trim() || !context.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: saveTitle.trim(), prompt: context.trim() }),
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
        setContext(data.prompt);
        setGenerated(true);
      } else {
        setGenError(data.error || "Failed to generate");
      }
    } catch { setGenError("Network error — could not reach the server"); }
    finally { setGenerating(false); }
  };

  const tokens = useMemo(
    () => numbers.split(/[\n,]+/).map((n) => n.trim()).filter(Boolean),
    [numbers]
  );

  const contactRows = useMemo<ContactRow[]>(() => {
    const seen = new Set<string>();
    return tokens.map((raw, index) => {
      const normalized = normalizePhoneNumber(raw);
      let state: ContactState = "valid";
      if (!normalized) state = "invalid";
      else if (seen.has(normalized)) state = "duplicate";
      else seen.add(normalized);
      return { index, raw, normalized, state, name: contactNames[normalized ?? raw] ?? contactNames[raw] };
    });
  }, [tokens, contactNames]);

  const validPhones = useMemo(
    () => contactRows.filter((r) => r.state === "valid").map((r) => r.normalized as string),
    [contactRows]
  );
  const duplicateCount = contactRows.filter((r) => r.state === "duplicate").length;
  const invalidCount = contactRows.filter((r) => r.state === "invalid").length;
  const totalBatches = Math.ceil(validPhones.length / GROUP_SIZE);

  const existingNumbersNormalized = () => tokens.map((n) => normalizePhoneNumber(n) ?? n);

  const applyColumn = (columnIndex: number, rows: string[][] = fileRows, headers: string[] = fileHeaders) => {
    setShowColumnPicker(false);
    const nameColumnIndex = detectNameColumnIndex(headers);
    const result = extractPhoneNumbers(rows, columnIndex, existingNumbersNormalized(), nameColumnIndex);
    setParsedPreview(result);
    if (Object.keys(result.names).length > 0) {
      setContactNames((prev) => ({ ...prev, ...result.names }));
    }
    // Auto-add — no extra click needed to get imported numbers into the dial list
    if (result.valid.length > 0) {
      setNumbers([...tokens, ...result.valid].join("\n"));
    }
  };

  const resetFileState = () => {
    setFileName("");
    setFileHeaders([]);
    setFileRows([]);
    setShowColumnPicker(false);
    setParsedPreview(null);
  };

  const clearAllNumbers = () => {
    setNumbers("");
    setContactNames({});
    resetFileState();
    setReviewPage(1);
  };

  const removeToken = (index: number) => {
    setNumbers(tokens.filter((_, i) => i !== index).join("\n"));
  };

  const removeByState = (state: ContactState) => {
    const keep = new Set(contactRows.filter((r) => r.state !== state).map((r) => r.index));
    setNumbers(tokens.filter((_, i) => keep.has(i)).join("\n"));
    setReviewPage(1);
  };

  const processFile = async (file: File) => {
    setFileError("");
    resetFileState();

    const ext = file.name.toLowerCase().split(".").pop();
    if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
      setFileError("Unsupported file type — upload a .csv, .xlsx, or .xls file");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const { headers, rows } = parseContactWorkbook(buffer);
      if (rows.length === 0) {
        setFileError("This file has no data rows");
        return;
      }

      setFileName(file.name);
      setFileHeaders(headers);
      setFileRows(rows);

      const detected = detectPhoneColumnIndex(headers);
      if (detected !== null) {
        applyColumn(detected, rows, headers);
      } else {
        setShowColumnPicker(true);
      }
    } catch {
      setFileError("Could not read this file — make sure it's a valid CSV/Excel file");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) processFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleSheetImport = async () => {
    const url = sheetUrl.trim();
    if (!url) return;

    setSheetError("");
    setSheetLoading(true);
    resetFileState();

    try {
      const res = await fetch("/api/sheets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet_url: url }),
      });
      const data = await res.json();

      if (!data.success) {
        setSheetError(data.error || "Could not import this sheet");
        return;
      }

      setFileName("Google Sheet");
      setFileHeaders(data.headers);
      setFileRows(data.rows);

      const detected = detectPhoneColumnIndex(data.headers);
      if (detected !== null) {
        applyColumn(detected, data.rows, data.headers);
      } else {
        setShowColumnPicker(true);
      }
    } catch {
      setSheetError("Network error — could not reach the server");
    } finally {
      setSheetLoading(false);
    }
  };

  const dispatchToNumbers = useCallback(async (phoneList: string[]) => {
    if (phoneList.length === 0) return;
    const agent = selectedAgentRef.current;
    const baseValues = variableValuesRef.current;
    const contacts = phoneList.map((phone) => {
      const values = contactNamesRef.current[phone] ? { ...baseValues, name: contactNamesRef.current[phone] } : baseValues;
      return {
        phone,
        prompt: substituteVariables(contextRef.current, values).trim(),
        first_message: substituteVariables(firstMessageRef.current, values).trim(),
        name: values.name,
      };
    });

    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts,
          agent_id: agent?.group_id,
          tts_provider: agent?.voice_provider,
          voice_id: agent?.voice_id ?? voiceRef.current,
          model_provider: agent?.llm_provider ?? modelProviderRef.current,
          language: agent?.language ?? languageRef.current,
          temperature: temperatureRef.current,
          sheet_url: sheetUrlRef.current.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.results)) {
        setResults((prev) => [...data.results, ...prev]);
      } else {
        const error = data.error || "Unknown error";
        setResults((prev) => [...phoneList.map((phone) => ({ phone, status: "failed" as const, error })), ...prev]);
        setAutoCallStatus(`Last check failed: ${error}`);
      }
    } catch {
      setResults((prev) => [
        ...phoneList.map((phone) => ({ phone, status: "failed" as const, error: "Network error — check server" })),
        ...prev,
      ]);
    }
  }, []);

  const checkSheetForNewNumbers = useCallback(async () => {
    const url = sheetUrlRef.current.trim();
    if (!url) return;

    // Reuse the Import button's loading state so the user sees feedback on every auto-check too
    setSheetLoading(true);
    try {
      const res = await fetch("/api/sheets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet_url: url }),
      });
      const data = await res.json();

      if (!data.success) {
        setAutoCallStatus(`Last check failed: ${data.error}`);
        return;
      }

      const columnIndex = detectPhoneColumnIndex(data.headers);
      if (columnIndex === null) {
        setAutoCallStatus("Last check: couldn't detect a phone number column in the sheet");
        return;
      }

      const nameColumnIndex = detectNameColumnIndex(data.headers);
      const extracted = extractPhoneNumbers(data.rows, columnIndex, calledNumbersRef.current, nameColumnIndex);
      const checkedAt = new Date().toLocaleTimeString("en-IN");

      if (extracted.valid.length > 0) {
        extracted.valid.forEach((n) => calledNumbersRef.current.add(n));
        if (Object.keys(extracted.names).length > 0) {
          setContactNames((prev) => ({ ...prev, ...extracted.names }));
          contactNamesRef.current = { ...contactNamesRef.current, ...extracted.names };
        }
        setAutoCallStatus(`Calling ${extracted.valid.length} new number${extracted.valid.length !== 1 ? "s" : ""} found at ${checkedAt}`);
        await dispatchToNumbers(extracted.valid);
      } else {
        setAutoCallStatus(`No new numbers found — last checked ${checkedAt}`);
      }
    } catch {
      setAutoCallStatus("Last check failed: network error");
    } finally {
      setSheetLoading(false);
    }
  }, [dispatchToNumbers]);

  const startAutoCall = () => {
    // Seed already-known numbers so the first check doesn't re-call people already in the list/results
    existingNumbersNormalized().forEach((n) => calledNumbersRef.current.add(n));
    results.forEach((r) => calledNumbersRef.current.add(r.phone));

    setAutoCallEnabled(true);
    setAutoCallStatus("Checking sheet now...");
    checkSheetForNewNumbers();
    autoCallIntervalRef.current = setInterval(checkSheetForNewNumbers, 60_000);
  };

  const handleToggleAutoCall = () => {
    if (autoCallEnabled) {
      if (autoCallIntervalRef.current) clearInterval(autoCallIntervalRef.current);
      autoCallIntervalRef.current = null;
      setAutoCallEnabled(false);
      setAutoCallStatus("");
      return;
    }

    if (!sheetUrl.trim()) {
      setSheetError("Enter a Google Sheet link above to enable auto-calling");
      return;
    }
    setConfirm({ kind: "autocall" });
  };

  // Polls /api/calls every 2s (up to 60s) until every given room_name has left
  // "ringing"/"connected", so the next group isn't dispatched while this one is still live.
  const waitForGroupToFinish = async (roomNames: string[]) => {
    const deadline = Date.now() + GROUP_WAIT_MS;
    const pending = new Set(roomNames);
    const tracked = new Set(roomNames);
    while (pending.size > 0 && Date.now() < deadline && !cancelLaunchRef.current) {
      await new Promise((resolve) => setTimeout(resolve, GROUP_POLL_MS));
      try {
        const res = await fetch("/api/calls");
        const data = await res.json();
        if (Array.isArray(data.calls)) {
          const updates: Record<string, string> = {};
          for (const call of data.calls) {
            if (!tracked.has(call.room_name)) continue;
            updates[call.room_name] = call.status;
            if (pending.has(call.room_name) && call.status !== "ringing" && call.status !== "connected") {
              pending.delete(call.room_name);
            }
          }
          if (Object.keys(updates).length > 0) setRoomStatus((prev) => ({ ...prev, ...updates }));
        }
      } catch {
        // transient fetch error while polling — keep retrying until deadline
      }
    }
  };

  const handleLaunch = async () => {
    const phones = validPhones;
    if (phones.length === 0) return;
    cancelLaunchRef.current = false;
    setStopRequested(false);
    setLoading(true);
    setResults([]);
    setRoomStatus({});
    setRunError("");
    setLaunchStatus("");
    setRunPhones(phones);
    setMonitorPage(1);
    setMonitorSearch("");
    setMonitorFilter("all");
    setBatchInfo({ current: 0, total: Math.ceil(phones.length / GROUP_SIZE) });
    setStep(4);

    // Per-contact substitution — {{name}} is overridden with the sheet's own value per phone
    // number when available, so one campaign can personalize each call instead of reusing
    // a single shared name for everyone.
    const contacts = phones.map((phone) => {
      const values = contactNames[phone] ? { ...variableValues, name: contactNames[phone] } : variableValues;
      return {
        phone,
        prompt: substituteVariables(context, values).trim(),
        first_message: substituteVariables(firstMessage, values).trim(),
        name: values.name,
      };
    });

    // Dispatched 5 at a time: each /api/queue request only creates the rooms/dials for one
    // small group and returns immediately (fast, can't time out), then we poll /api/calls
    // client-side until every call in that group leaves "ringing"/"connected" before
    // sending the next group — this keeps the wait out of the serverless function entirely.
    let messageSet = false;
    for (let i = 0; i < contacts.length; i += GROUP_SIZE) {
      if (cancelLaunchRef.current) {
        setLaunchStatus(`Stopped — ${i} of ${contacts.length} numbers were already dispatched.`);
        messageSet = true;
        break;
      }
      setBatchInfo((prev) => ({ ...prev, current: i / GROUP_SIZE + 1 }));
      const group = contacts.slice(i, i + GROUP_SIZE);
      try {
        const res = await fetch("/api/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contacts: group,
            agent_id: selectedAgent?.group_id,
            tts_provider: selectedAgent?.voice_provider,
            voice_id: selectedAgent?.voice_id ?? voice,
            model_provider: selectedAgent?.llm_provider ?? modelProvider,
            language: selectedAgent?.language ?? language,
            temperature,
            sheet_url: sheetUrl.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (Array.isArray(data.results)) {
          setResults((prev) => [...prev, ...data.results]);
          const roomNames = data.results
            .filter((r: DialResult) => r.status === "dispatched" && r.room_name)
            .map((r: DialResult) => r.room_name as string);
          if (roomNames.length > 0) {
            await waitForGroupToFinish(roomNames);
          }
        } else {
          const error = data.error || "Unknown error";
          setResults((prev) => [
            ...prev,
            ...group.map((c) => ({ phone: c.phone, status: "failed" as const, error })),
          ]);
          // 403 = no active plan / call allowance used up — every later batch would fail the same way
          if (res.status === 403) {
            setRunError(error);
            setLaunchStatus(`Stopped — ${i} of ${contacts.length} numbers were dispatched before the plan limit was hit.`);
            cancelLaunchRef.current = true;
            messageSet = true;
            break;
          }
        }
      } catch {
        setResults((prev) => [
          ...prev,
          ...group.map((c) => ({ phone: c.phone, status: "failed" as const, error: "Network error — check server" })),
        ]);
      }
    }

    if (!messageSet) setLaunchStatus(cancelLaunchRef.current ? "Campaign stopped." : "");
    setLoading(false);
  };

  const handleStopLaunch = () => {
    cancelLaunchRef.current = true;
    setStopRequested(true);
    setLaunchStatus("Stopping after the current batch finishes…");
  };

  const startNewCampaign = () => {
    clearAllNumbers();
    setResults([]);
    setRunPhones([]);
    setRoomStatus({});
    setRunError("");
    setLaunchStatus("");
    setStopRequested(false);
    setStep(1);
  };

  const resultByPhone = useMemo(() => {
    const map = new Map<string, DialResult>();
    for (const r of results) if (!map.has(r.phone)) map.set(r.phone, r);
    return map;
  }, [results]);

  const statusFor = useCallback(
    (phone: string): RunStatus => {
      const r = resultByPhone.get(phone);
      if (!r) return loading ? "queued" : "not-sent";
      if (r.status === "failed") return "failed";
      return runStatusFromCall(r.room_name ? roomStatus[r.room_name] : undefined);
    },
    [resultByPhone, roomStatus, loading]
  );

  const monitorRows = useMemo(() => {
    const phones = [...runPhones];
    const inRun = new Set(runPhones);
    for (const r of results) if (!inRun.has(r.phone)) { inRun.add(r.phone); phones.push(r.phone); }
    return phones.map((phone) => ({
      phone,
      name: contactNames[phone],
      status: statusFor(phone),
      error: resultByPhone.get(phone)?.error,
    }));
  }, [runPhones, results, contactNames, statusFor, resultByPhone]);

  const runCounts = useMemo(() => {
    const c = { total: monitorRows.length, queued: 0, inProgress: 0, completed: 0, failed: 0, notSent: 0 };
    for (const r of monitorRows) {
      if (r.status === "queued") c.queued++;
      else if (r.status === "ringing" || r.status === "in-progress") c.inProgress++;
      else if (r.status === "completed") c.completed++;
      else if (r.status === "failed" || r.status === "no-answer") c.failed++;
      else c.notSent++;
    }
    return c;
  }, [monitorRows]);

  // After a run ends (or for auto-called numbers) keep call statuses fresh until they settle
  const unsettledRooms = useMemo(
    () =>
      results
        .filter((r) => r.status === "dispatched" && r.room_name && !FINAL_CALL_STATUSES.has(roomStatus[r.room_name as string] ?? ""))
        .map((r) => r.room_name as string),
    [results, roomStatus]
  );
  const unsettledKey = unsettledRooms.join("|");

  useEffect(() => {
    if (loading || !unsettledKey) return;
    const tracked = new Set(unsettledKey.split("|"));
    let cancelled = false;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/calls");
        const data = await res.json();
        if (cancelled || !Array.isArray(data.calls)) return;
        const updates: Record<string, string> = {};
        for (const call of data.calls) if (tracked.has(call.room_name)) updates[call.room_name] = call.status;
        if (Object.keys(updates).length > 0) setRoomStatus((prev) => ({ ...prev, ...updates }));
      } catch { /* retry next tick */ }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [loading, unsettledKey]);

  const reviewFiltered = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    const qDigits = q.replace(/[^\d]/g, "");
    return contactRows.filter((r) => {
      if (reviewFilter !== "all" && r.state !== reviewFilter) return false;
      if (!q) return true;
      return (
        r.raw.toLowerCase().includes(q) ||
        (r.name ?? "").toLowerCase().includes(q) ||
        (qDigits !== "" && (r.normalized ?? "").replace(/[^\d]/g, "").includes(qDigits))
      );
    });
  }, [contactRows, reviewSearch, reviewFilter]);
  const reviewPages = Math.max(1, Math.ceil(reviewFiltered.length / PAGE_SIZE));
  const reviewCurrent = Math.min(reviewPage, reviewPages);
  const reviewSlice = reviewFiltered.slice((reviewCurrent - 1) * PAGE_SIZE, reviewCurrent * PAGE_SIZE);

  const monitorFiltered = useMemo(() => {
    const q = monitorSearch.trim().toLowerCase();
    const qDigits = q.replace(/[^\d]/g, "");
    return monitorRows.filter((r) => {
      if (monitorFilter !== "all" && r.status !== monitorFilter) return false;
      if (!q) return true;
      return (
        r.phone.toLowerCase().includes(q) ||
        (r.name ?? "").toLowerCase().includes(q) ||
        (qDigits !== "" && r.phone.replace(/[^\d]/g, "").includes(qDigits))
      );
    });
  }, [monitorRows, monitorSearch, monitorFilter]);
  const monitorPages = Math.max(1, Math.ceil(monitorFiltered.length / PAGE_SIZE));
  const monitorCurrent = Math.min(monitorPage, monitorPages);
  const monitorSlice = monitorFiltered.slice((monitorCurrent - 1) * PAGE_SIZE, monitorCurrent * PAGE_SIZE);

  const exportResults = () => {
    if (monitorRows.length === 0) return;
    const cell = (v: string) => {
      const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = monitorRows.map((r) => [r.phone, r.name ?? "", RUN_STATUS_META[r.status].label, r.error ?? ""].map(cell).join(","));
    const blob = new Blob(["\uFEFF" + ["Phone,Name,Status,Error", ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scriptVars = !selectedAgent ? extractVariableNames(context) : [];
  const sortedSaved = useMemo(() => [...savedPrompts].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0)), [savedPrompts]);

  const canVisit = (n: number) => {
    if (n === 1) return true;
    if (n === 4) return runPhones.length > 0 || results.length > 0;
    return contactRows.length > 0;
  };

  const runFinished = !loading && runPhones.length > 0;
  const donePct = runCounts.total ? Math.round(((runCounts.completed + runCounts.failed) / runCounts.total) * 100) : 0;
  const seg = (n: number) => (runCounts.total ? `${(n / runCounts.total) * 100}%` : "0%");

  const renderVariables = (names: string[], placeholder: (n: string) => string) =>
    names.length > 0 && (
      <div className="cl2-vars">
        {names.map((name) => (
          <div key={name} className="cl2-var-row">
            <label htmlFor={`bulk-var-${name}`} className="cl2-var-token">{"{{" + name + "}}"}</label>
            <input
              id={`bulk-var-${name}`}
              type="text"
              className="cl2-input cl2-input-sm"
              placeholder={placeholder(name)}
              value={variableValues[name] ?? ""}
              onChange={(e) => setVariableValues((prev) => ({ ...prev, [name]: e.target.value }))}
            />
          </div>
        ))}
      </div>
    );

  const renderPager = (current: number, pages: number, total: number, setPage: (n: number) => void) => (
    <div className="cl2-pagination">
      <span>
        {total === 0 ? "No rows" : `Showing ${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, total)} of ${fmt(total)}`}
      </span>
      <div className="cl2-pagination-btns">
        <button type="button" className="cl2-btn cl2-btn-sm" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page">
          <ChevronLeft size={14} aria-hidden="true" /> Prev
        </button>
        <span className="cl2-page-indicator">Page {current} of {pages}</span>
        <button type="button" className="cl2-btn cl2-btn-sm" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label="Next page">
          Next <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return (
    <section className="cl2 cl2-panel" aria-label="Bulk campaign">
      <div className="cl2-panel-head">
        <div>
          <h2 className="cl2-title">Bulk campaign</h2>
          <p className="cl2-muted">Import contacts, review them, then call everyone with your AI agent in paced batches.</p>
        </div>
        <div className="cl2-head-actions">
          {autoCallEnabled && <Pill tone="ok" label="Auto-call on" />}
          {loading && <Pill tone="info" label="Campaign running" />}
          {!loading && !autoCallEnabled && <Pill tone="muted" label="Batch dialer" />}
        </div>
      </div>

      <ol className="cl2-stepper" aria-label="Campaign steps">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step || (n === 4 && runFinished);
          const allowed = canVisit(n);
          return (
            <li key={label}>
              <button
                type="button"
                className={`cl2-step ${step === n ? "is-active" : ""} ${done ? "is-done" : ""}`}
                aria-current={step === n ? "step" : undefined}
                disabled={!allowed}
                onClick={() => setStep(n)}
              >
                <span className="cl2-step-num">{done && step !== n ? <Check size={13} aria-hidden="true" /> : n}</span>
                <span className="cl2-step-label">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* ───────── Step 1 · Source ───────── */}
      {step === 1 && (
        <div className="cl2-step-body">
          <div className="cl2-source-grid">
            <div className="cl2-source-card">
              <div className="cl2-source-head">
                <Upload size={16} aria-hidden="true" />
                <div>
                  <h3>Upload a file</h3>
                  <p className="cl2-muted">CSV or Excel with a phone column</p>
                </div>
                {fileName && fileName !== "Google Sheet" && (
                  <button type="button" className="cl2-link" onClick={resetFileState}>Clear</button>
                )}
              </div>
              <label
                htmlFor="bulk-file"
                className={`cl2-dropzone ${dragging ? "is-drag" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <FileSpreadsheet size={22} aria-hidden="true" />
                <strong>{fileName && fileName !== "Google Sheet" ? fileName : "Drop a file here or click to browse"}</strong>
                <span className="cl2-muted">.csv, .xlsx or .xls — the phone column is detected from headers like &quot;Phone&quot; or &quot;Mobile&quot;</span>
                <input id="bulk-file" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="cl2-sr-only" />
              </label>
              {fileError && (
                <p className="cl2-inline-error" role="alert"><CircleAlert size={14} aria-hidden="true" /> {fileError}</p>
              )}
            </div>

            <div className="cl2-source-card">
              <div className="cl2-source-head">
                <FileSpreadsheet size={16} aria-hidden="true" />
                <div>
                  <h3>Google Sheet</h3>
                  <p className="cl2-muted">Shared as &quot;Anyone with the link can view&quot;</p>
                </div>
              </div>

              {savedSheets.length > 0 && (
                <select
                  aria-label="Load a saved sheet"
                  onChange={(e) => {
                    const selected = savedSheets.find((s) => s.id === e.target.value);
                    if (selected) setSheetUrl(selected.sheet_url);
                    e.target.value = "";
                  }}
                  defaultValue=""
                  className="cl2-input cl2-input-sm"
                >
                  <option value="" disabled>Load a saved sheet ({savedSheets.length})…</option>
                  {savedSheets.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              )}

              <div className="cl2-inline">
                <input
                  id="bulk-sheet-url"
                  type="url"
                  className="cl2-input"
                  aria-label="Google Sheet link"
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  value={sheetUrl}
                  onChange={(e) => { setSheetUrl(e.target.value); setSheetError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSheetImport(); } }}
                />
                <button type="button" className="cl2-btn cl2-btn-primary" onClick={handleSheetImport} disabled={sheetLoading || !sheetUrl.trim()}>
                  {sheetLoading ? <><span className="cl2-spin" aria-hidden="true" /> Importing…</> : "Import"}
                </button>
              </div>
              {sheetError && (
                <p className="cl2-inline-error" role="alert"><CircleAlert size={14} aria-hidden="true" /> {sheetError}</p>
              )}

              <div className="cl2-link-row">
                <button type="button" className="cl2-link" onClick={() => setShowSaveSheetInput(!showSaveSheetInput)} disabled={!sheetUrl.trim()}>
                  {showSaveSheetInput ? "Cancel" : "Save this sheet"}
                </button>
                {savedSheets.length > 0 && (
                  <button type="button" className="cl2-link" onClick={() => setShowSavedSheetsList(!showSavedSheetsList)}>
                    {showSavedSheetsList ? "Hide saved sheets" : "Manage saved sheets"}
                  </button>
                )}
              </div>

              {showSaveSheetInput && (
                <div className="cl2-inline">
                  <input
                    type="text"
                    className="cl2-input cl2-input-sm"
                    aria-label="Sheet name"
                    placeholder="Give this sheet a name…"
                    value={saveSheetLabel}
                    onChange={(e) => setSaveSheetLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveSheet(); } }}
                  />
                  <button type="button" className="cl2-btn cl2-btn-primary cl2-btn-sm" onClick={handleSaveSheet} disabled={savingSheet || !saveSheetLabel.trim()}>
                    {savingSheet ? "Saving…" : "Save"}
                  </button>
                </div>
              )}

              {showSavedSheetsList && savedSheets.length > 0 && (
                <ul className="cl2-list" aria-label="Saved sheets">
                  {savedSheets.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="cl2-list-main" onClick={() => setSheetUrl(s.sheet_url)} title="Use this sheet">
                        <span className="cl2-strong">{s.label}</span>
                        <span className="cl2-muted cl2-truncate">{s.sheet_url}</span>
                      </button>
                      <button type="button" className="cl2-icon-btn cl2-icon-danger" onClick={() => setConfirm({ kind: "sheet", item: s })} aria-label={`Delete ${s.label}`}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="cl2-switch-row">
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoCallEnabled}
                  aria-label="Auto-call new numbers from this sheet"
                  className={`cl2-switch ${autoCallEnabled ? "is-on" : ""}`}
                  onClick={handleToggleAutoCall}
                >
                  <span />
                </button>
                <div>
                  <strong>Auto-call new numbers</strong>
                  <p className="cl2-muted">
                    Checks this sheet now and every minute, then immediately calls any number it hasn&apos;t seen — no Import click needed.
                  </p>
                </div>
              </div>
              {autoCallStatus && <p className="cl2-hint" role="status">{autoCallStatus}</p>}
            </div>

            <div className="cl2-source-card cl2-source-wide">
              <div className="cl2-source-head">
                <ClipboardList size={16} aria-hidden="true" />
                <div>
                  <h3>Paste numbers</h3>
                  <p className="cl2-muted">One per line or comma-separated. 10-digit numbers are treated as Indian (+91).</p>
                </div>
                {tokens.length > 0 && (
                  <button type="button" className="cl2-link cl2-text-danger" onClick={() => setConfirm({ kind: "clear" })}>Clear all</button>
                )}
              </div>
              <label htmlFor="bulk-numbers" className="cl2-sr-only">Phone numbers</label>
              <textarea
                id="bulk-numbers"
                rows={5}
                className="cl2-input cl2-textarea cl2-mono"
                placeholder={"9876543210\n+14155550100\n8765432100"}
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
              />
              {tokens.length > 0 && (
                <p className="cl2-count-line" aria-live="polite">
                  <strong>{fmt(tokens.length)}</strong> entr{tokens.length !== 1 ? "ies" : "y"} ·{" "}
                  <span className="cl2-text-ok">{fmt(validPhones.length)} ready</span>
                  {duplicateCount > 0 && <> · <span className="cl2-text-warn">{fmt(duplicateCount)} duplicate{duplicateCount !== 1 ? "s" : ""}</span></>}
                  {invalidCount > 0 && <> · <span className="cl2-text-danger">{fmt(invalidCount)} invalid</span></>}
                </p>
              )}
            </div>
          </div>

          {showColumnPicker && fileHeaders.length > 0 && (
            <div className="cl2-callout cl2-callout-warn">
              <Info size={16} aria-hidden="true" />
              <div className="cl2-callout-body">
                <label htmlFor="bulk-column-picker" className="cl2-label">We couldn&apos;t find a phone column — which one has the numbers?</label>
                <select
                  id="bulk-column-picker"
                  defaultValue=""
                  onChange={(e) => applyColumn(parseInt(e.target.value, 10))}
                  className="cl2-input cl2-input-sm"
                >
                  <option value="" disabled>Select a column…</option>
                  {fileHeaders.map((h, i) => (
                    <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {parsedPreview && (
            <div className="cl2-callout cl2-callout-ok" role="status">
              <CircleCheck size={16} aria-hidden="true" />
              <div className="cl2-callout-body">
                <strong>
                  Imported {fmt(parsedPreview.valid.length)} number{parsedPreview.valid.length !== 1 ? "s" : ""} from {fileName || "file"}
                </strong>
                <span className="cl2-muted">
                  {parsedPreview.duplicateCount > 0 && <>{fmt(parsedPreview.duplicateCount)} duplicate{parsedPreview.duplicateCount !== 1 ? "s" : ""} skipped · </>}
                  {parsedPreview.invalid.length > 0 ? `${fmt(parsedPreview.invalid.length)} invalid entr${parsedPreview.invalid.length !== 1 ? "ies" : "y"} skipped` : "no invalid entries"}
                </span>
                {parsedPreview.invalid.length > 0 && (
                  <details>
                    <summary>Show invalid entries</summary>
                    <p className="cl2-mono cl2-break">{parsedPreview.invalid.join(", ")}</p>
                  </details>
                )}
              </div>
              <button type="button" className="cl2-btn cl2-btn-sm" onClick={resetFileState}>Dismiss</button>
            </div>
          )}

          <div className="cl2-footer-nav">
            <span className="cl2-muted">
              {validPhones.length > 0 ? `${fmt(validPhones.length)} contact${validPhones.length !== 1 ? "s" : ""} ready to review` : "Add contacts from a file, a sheet, or paste them above."}
            </span>
            <button type="button" className="cl2-btn cl2-btn-primary" disabled={contactRows.length === 0} onClick={() => setStep(2)}>
              Review contacts <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ───────── Step 2 · Review ───────── */}
      {step === 2 && (
        <div className="cl2-step-body">
          <div className="cl2-kpis">
            <div className="cl2-kpi"><span className="cl2-kpi-label">Total entries</span><span className="cl2-kpi-value">{fmt(contactRows.length)}</span><span className="cl2-kpi-sub">in your list</span></div>
            <div className="cl2-kpi"><span className="cl2-kpi-label">Ready to call</span><span className="cl2-kpi-value cl2-text-ok">{fmt(validPhones.length)}</span><span className="cl2-kpi-sub">{totalBatches} batch{totalBatches !== 1 ? "es" : ""} of up to {GROUP_SIZE}</span></div>
            <div className="cl2-kpi"><span className="cl2-kpi-label">Duplicates</span><span className={`cl2-kpi-value ${duplicateCount ? "cl2-text-warn" : ""}`}>{fmt(duplicateCount)}</span><span className="cl2-kpi-sub">{duplicateCount ? "will be skipped" : "none found"}</span></div>
            <div className="cl2-kpi"><span className="cl2-kpi-label">Invalid</span><span className={`cl2-kpi-value ${invalidCount ? "cl2-text-danger" : ""}`}>{fmt(invalidCount)}</span><span className="cl2-kpi-sub">{invalidCount ? "will be skipped" : "none found"}</span></div>
          </div>

          {(duplicateCount > 0 || invalidCount > 0) && (
            <div className="cl2-callout cl2-callout-warn" role="status">
              <TriangleAlert size={16} aria-hidden="true" />
              <div className="cl2-callout-body">
                <strong>{fmt(duplicateCount + invalidCount)} entr{duplicateCount + invalidCount !== 1 ? "ies" : "y"} won&apos;t be called</strong>
                <span className="cl2-muted">Duplicates (same number twice) and invalid numbers (must be 7–15 digits) are skipped automatically. You can remove them now to keep the list clean.</span>
              </div>
              <div className="cl2-callout-actions">
                {duplicateCount > 0 && <button type="button" className="cl2-btn cl2-btn-sm" onClick={() => removeByState("duplicate")}>Remove duplicates</button>}
                {invalidCount > 0 && <button type="button" className="cl2-btn cl2-btn-sm" onClick={() => removeByState("invalid")}>Remove invalid</button>}
              </div>
            </div>
          )}

          <div className="cl2-toolbar" role="search">
            <div className="cl2-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                className="cl2-input"
                placeholder="Search by number or name…"
                aria-label="Search contacts"
                value={reviewSearch}
                onChange={(e) => { setReviewSearch(e.target.value); setReviewPage(1); }}
              />
            </div>
            <select
              className="cl2-input cl2-select-auto"
              aria-label="Filter contacts by status"
              value={reviewFilter}
              onChange={(e) => { setReviewFilter(e.target.value as "all" | ContactState); setReviewPage(1); }}
            >
              <option value="all">All entries</option>
              <option value="valid">Ready</option>
              <option value="duplicate">Duplicates</option>
              <option value="invalid">Invalid</option>
            </select>
            <span className="cl2-count">{fmt(reviewFiltered.length)} shown</span>
          </div>

          {contactRows.length === 0 ? (
            <div className="cl2-empty">
              <ClipboardList size={34} aria-hidden="true" />
              <strong>No contacts yet</strong>
              <span>Go back and import a file, a Google Sheet, or paste numbers.</span>
              <button type="button" className="cl2-btn" onClick={() => setStep(1)}>Add contacts</button>
            </div>
          ) : reviewFiltered.length === 0 ? (
            <div className="cl2-empty">
              <Search size={34} aria-hidden="true" />
              <strong>No contacts match</strong>
              <span>Try a different search or filter.</span>
            </div>
          ) : (
            <>
              <div className="cl2-table-wrap">
                <table className="cl2-table">
                  <thead>
                    <tr>
                      <th scope="col" className="cl2-th-narrow">#</th>
                      <th scope="col">Phone</th>
                      <th scope="col">Name</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="cl2-th-right"><span className="cl2-sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewSlice.map((r) => (
                      <tr key={r.index}>
                        <td className="cl2-muted">{r.index + 1}</td>
                        <td className="cl2-mono cl2-strong">
                          {r.normalized ?? r.raw}
                          {r.normalized && r.normalized !== r.raw && <span className="cl2-muted cl2-raw"> from &quot;{r.raw}&quot;</span>}
                        </td>
                        <td>{r.name || <span className="cl2-muted">—</span>}</td>
                        <td>
                          <Pill tone={CONTACT_STATE_META[r.state].tone} label={CONTACT_STATE_META[r.state].label} />
                          {r.state === "invalid" && <span className="cl2-muted cl2-raw"> needs 7–15 digits</span>}
                        </td>
                        <td className="cl2-td-right">
                          <button type="button" className="cl2-icon-btn cl2-icon-danger" onClick={() => removeToken(r.index)} aria-label={`Remove ${r.raw}`}>
                            <X size={14} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {renderPager(reviewCurrent, reviewPages, reviewFiltered.length, setReviewPage)}
            </>
          )}

          <div className="cl2-footer-nav">
            <button type="button" className="cl2-btn" onClick={() => setStep(1)}><ChevronLeft size={14} aria-hidden="true" /> Back</button>
            <button type="button" className="cl2-btn cl2-btn-primary" disabled={validPhones.length === 0} onClick={() => setStep(3)}>
              Configure campaign <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ───────── Step 3 · Configure ───────── */}
      {step === 3 && (
        <div className="cl2-step-body">
          <div className="cl2-split cl2-split-aside">
            <div className="cl2-stack">
              {agents.length > 0 && (
                <div className="cl2-field">
                  <label htmlFor="bulk-agent-select" className="cl2-label">Saved agent <span className="cl2-optional">optional</span></label>
                  <select id="bulk-agent-select" className="cl2-input" value={selectedAgentId} onChange={(e) => handleSelectAgent(e.target.value)}>
                    <option value="">— Manual script —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <p className="cl2-hint">Selecting an agent fills in its script, voice, language and model.</p>
                  {selectedAgent && renderVariables((selectedAgent.variables ?? []).map((v) => v.name), () => "Value for this campaign")}
                </div>
              )}

              <div className="cl2-field">
                <label htmlFor="bulk-brief" className="cl2-label">Describe your campaign <span className="cl2-optional">AI script generator</span></label>
                <div className="cl2-inline">
                  <input
                    id="bulk-brief"
                    type="text"
                    className="cl2-input"
                    placeholder="e.g. Remind about appointment on June 20"
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
                {generated && <p className="cl2-hint cl2-text-ok" role="status">Script generated and added below — edit it before launching if you like.</p>}
                {genError && <p className="cl2-hint cl2-text-danger" role="alert">{genError}</p>}
              </div>

              <div className="cl2-field">
                <div className="cl2-label-row">
                  <label htmlFor="bulk-context" className="cl2-label">Campaign script</label>
                  <div className="cl2-label-actions">
                    {savedPrompts.length > 0 && (
                      <button type="button" className="cl2-link" onClick={() => setShowSavedList(!showSavedList)}>
                        {showSavedList ? "Hide saved scripts" : "Manage saved scripts"}
                      </button>
                    )}
                    {context.trim() && (
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
                      if (selected) setContext(selected.prompt);
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
                      aria-label="Script name"
                      placeholder="Give this script a name…"
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
                        <button type="button" className="cl2-list-main" onClick={() => setContext(sp.prompt)} title="Use this script">
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
                        <button type="button" className="cl2-icon-btn cl2-icon-danger" onClick={() => setConfirm({ kind: "script", item: sp })} aria-label={`Delete ${sp.title}`}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <textarea
                  id="bulk-context"
                  rows={9}
                  className="cl2-input cl2-textarea"
                  placeholder="Generated script will appear here, or type your own…"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
                <p className="cl2-hint">
                  {context.trim() ? `${fmt(context.trim().length)} characters` : "No script yet — the agent will use its defaults."}
                </p>

                {scriptVars.length > 0 && (
                  <>
                    <p className="cl2-hint">
                      Fill in a value for each variable in your script. <code>{"{{name}}"}</code> is filled per contact from your imported file/sheet when a name column exists.
                    </p>
                    {renderVariables(scriptVars, (n) => (n === "name" ? "Fallback if no per-contact name is found" : "Value for this campaign"))}
                  </>
                )}
              </div>

              <div className="cl2-form-row">
                <div className="cl2-field">
                  <label htmlFor="bulk-language" className="cl2-label">Language</label>
                  <select id="bulk-language" className="cl2-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="cl2-field">
                  <label htmlFor="bulk-voice" className="cl2-label">Voice</label>
                  <select id="bulk-voice" className="cl2-input" value={voice} onChange={(e) => setVoice(e.target.value)}>
                    {VOICE_GROUPS.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="cl2-aside">
              <div className="cl2-aside-card">
                <span className="cl2-label">Campaign summary</span>
                <dl className="cl2-summary">
                  <div><dt>Contacts to call</dt><dd>{fmt(validPhones.length)}</dd></div>
                  <div><dt>Skipped</dt><dd>{fmt(duplicateCount + invalidCount)}</dd></div>
                  <div><dt>Batches</dt><dd>{fmt(totalBatches)} × up to {GROUP_SIZE}</dd></div>
                  <div><dt>Agent</dt><dd>{selectedAgent ? selectedAgent.name : "Manual script"}</dd></div>
                  <div><dt>Language</dt><dd>{languageName(selectedAgent?.language ?? language)}</dd></div>
                  <div><dt>Voice</dt><dd>{voiceName(selectedAgent?.voice_id ?? voice)}</dd></div>
                </dl>
              </div>
              <div className="cl2-aside-card cl2-aside-info">
                <span className="cl2-label"><Info size={13} aria-hidden="true" /> How calls are paced</span>
                <ul>
                  <li>Calls go out in <strong>batches of {GROUP_SIZE}</strong> — all numbers in a batch are dialled together.</li>
                  <li>The next batch starts only when <strong>every call in the current batch has ended</strong> (checked every {GROUP_POLL_MS / 1000}s, waiting up to {GROUP_WAIT_MS / 1000}s).</li>
                  <li>Pacing runs from this browser tab — <strong>keep it open</strong> until the campaign finishes.</li>
                  <li>Each dispatched call counts towards your monthly plan.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="cl2-footer-nav">
            <button type="button" className="cl2-btn" onClick={() => setStep(2)}><ChevronLeft size={14} aria-hidden="true" /> Back</button>
            <button type="button" className="cl2-btn cl2-btn-primary" disabled={loading || validPhones.length === 0} onClick={() => setConfirm({ kind: "launch" })}>
              <Rocket size={15} aria-hidden="true" /> Review &amp; launch ({fmt(validPhones.length)})
            </button>
          </div>
        </div>
      )}

      {/* ───────── Step 4 · Run & monitor ───────── */}
      {step === 4 && (
        <div className="cl2-step-body">
          <div className="cl2-run-head">
            <div>
              <h3 className="cl2-subtitle">
                {loading ? "Campaign in progress" : runError ? "Campaign stopped — plan limit" : stopRequested ? "Campaign stopped" : runFinished ? "Campaign finished" : "Campaign"}
              </h3>
              <p className="cl2-muted">
                {loading
                  ? `Batch ${batchInfo.current} of ${batchInfo.total} · keep this tab open while calls are paced.`
                  : `${fmt(runCounts.total)} number${runCounts.total !== 1 ? "s" : ""} in this run.`}
              </p>
            </div>
            <div className="cl2-head-actions">
              {loading ? (
                <button type="button" className="cl2-btn cl2-btn-danger" onClick={handleStopLaunch} disabled={stopRequested}>
                  <Square size={13} aria-hidden="true" /> {stopRequested ? "Stopping…" : "Stop campaign"}
                </button>
              ) : (
                <>
                  <button type="button" className="cl2-btn" onClick={exportResults} disabled={monitorRows.length === 0}>
                    <Download size={14} aria-hidden="true" /> Export CSV
                  </button>
                  <button type="button" className="cl2-btn" onClick={() => setStep(3)}>Edit setup</button>
                  <button type="button" className="cl2-btn cl2-btn-primary" onClick={startNewCampaign}>New campaign</button>
                </>
              )}
            </div>
          </div>

          {runError && (
            <div className="cl2-callout cl2-callout-danger" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />
              <div className="cl2-callout-body">
                <strong>Plan limit reached</strong>
                <span>{runError}</span>
                <span className="cl2-muted">Remaining batches were not sent. Contact your admin or upgrade your plan, then run the rest as a new campaign.</span>
              </div>
            </div>
          )}
          {launchStatus && !runError && (
            <p className="cl2-hint cl2-text-warn" role="status">{launchStatus}</p>
          )}

          <div className="cl2-progress-card">
            <div className="cl2-progress-top">
              <strong>{donePct}% done</strong>
              <span className="cl2-muted">{fmt(runCounts.completed + runCounts.failed)} of {fmt(runCounts.total)} calls finished</span>
            </div>
            <div
              className="cl2-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={donePct}
              aria-label="Campaign progress"
            >
              <span className="cl2-seg-ok" style={{ width: seg(runCounts.completed) }} />
              <span className="cl2-seg-info" style={{ width: seg(runCounts.inProgress) }} />
              <span className="cl2-seg-danger" style={{ width: seg(runCounts.failed) }} />
            </div>
            <div className="cl2-progress-legend">
              <span><i className="cl2-dot cl2-dot-muted" /> Queued <strong>{fmt(runCounts.queued + runCounts.notSent)}</strong></span>
              <span><i className="cl2-dot cl2-dot-info" /> In progress <strong>{fmt(runCounts.inProgress)}</strong></span>
              <span><i className="cl2-dot cl2-dot-ok" /> Completed <strong>{fmt(runCounts.completed)}</strong></span>
              <span><i className="cl2-dot cl2-dot-danger" /> Failed / no answer <strong>{fmt(runCounts.failed)}</strong></span>
            </div>
          </div>

          <div className="cl2-toolbar" role="search">
            <div className="cl2-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                className="cl2-input"
                placeholder="Search by number or name…"
                aria-label="Search campaign contacts"
                value={monitorSearch}
                onChange={(e) => { setMonitorSearch(e.target.value); setMonitorPage(1); }}
              />
            </div>
            <select
              className="cl2-input cl2-select-auto"
              aria-label="Filter by call status"
              value={monitorFilter}
              onChange={(e) => { setMonitorFilter(e.target.value as "all" | RunStatus); setMonitorPage(1); }}
            >
              <option value="all">All statuses</option>
              {(Object.keys(RUN_STATUS_META) as RunStatus[]).map((s) => <option key={s} value={s}>{RUN_STATUS_META[s].label}</option>)}
            </select>
            <span className="cl2-count">{fmt(monitorFiltered.length)} shown</span>
          </div>

          {monitorRows.length === 0 ? (
            <div className="cl2-empty">
              <Rocket size={34} aria-hidden="true" />
              <strong>No campaign running</strong>
              <span>Configure a campaign and launch it to monitor every call here.</span>
            </div>
          ) : monitorFiltered.length === 0 ? (
            <div className="cl2-empty">
              <Search size={34} aria-hidden="true" />
              <strong>No contacts match</strong>
              <span>Try a different search or status filter.</span>
            </div>
          ) : (
            <>
              <div className="cl2-table-wrap">
                <table className="cl2-table">
                  <thead>
                    <tr>
                      <th scope="col">Phone</th>
                      <th scope="col">Name</th>
                      <th scope="col">Status</th>
                      <th scope="col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitorSlice.map((r) => (
                      <tr key={r.phone}>
                        <td className="cl2-mono cl2-strong">{r.phone}</td>
                        <td>{r.name || <span className="cl2-muted">—</span>}</td>
                        <td><Pill tone={RUN_STATUS_META[r.status].tone} label={RUN_STATUS_META[r.status].label} /></td>
                        <td className="cl2-muted">{r.error ?? (r.status === "not-sent" ? "Campaign stopped before this batch" : "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {renderPager(monitorCurrent, monitorPages, monitorFiltered.length, setMonitorPage)}
            </>
          )}
        </div>
      )}

      {confirm?.kind === "launch" && (
        <ConfirmDialog
          title="Launch this campaign?"
          tone="primary"
          confirmLabel={`Call ${fmt(validPhones.length)} number${validPhones.length !== 1 ? "s" : ""}`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); handleLaunch(); }}
        >
          <dl className="cl2-summary">
            <div><dt>Contacts</dt><dd>{fmt(validPhones.length)}</dd></div>
            <div><dt>Skipped</dt><dd>{fmt(duplicateCount + invalidCount)} ({fmt(duplicateCount)} duplicate, {fmt(invalidCount)} invalid)</dd></div>
            <div><dt>Batches</dt><dd>{fmt(totalBatches)} × up to {GROUP_SIZE} simultaneous calls</dd></div>
            <div><dt>Agent</dt><dd>{selectedAgent ? selectedAgent.name : "Manual script"}</dd></div>
            <div><dt>Voice / language</dt><dd>{voiceName(selectedAgent?.voice_id ?? voice)} · {languageName(selectedAgent?.language ?? language)}</dd></div>
          </dl>
          {!context.trim() && (
            <p className="cl2-inline-error"><TriangleAlert size={14} aria-hidden="true" /> No script entered — the agent will use its defaults.</p>
          )}
          <p className="cl2-muted">Calls start immediately and each dispatched call counts towards your monthly plan. Keep this tab open until the campaign finishes.</p>
        </ConfirmDialog>
      )}

      {confirm?.kind === "autocall" && (
        <ConfirmDialog
          title="Turn on auto-calling?"
          tone="primary"
          confirmLabel="Turn on and check now"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); startAutoCall(); }}
        >
          <p>The sheet will be checked right away and then every minute. <strong>Every new number found is called immediately</strong> with the script and voice currently configured — with no further confirmation.</p>
          <p className="cl2-muted">Numbers already in your list or results are not called again. Keep this tab open; turn the switch off to stop.</p>
        </ConfirmDialog>
      )}

      {confirm?.kind === "clear" && (
        <ConfirmDialog
          title="Clear all contacts?"
          confirmLabel="Clear all"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { clearAllNumbers(); setConfirm(null); }}
        >
          <p>All {fmt(tokens.length)} entries and any imported names will be removed from this campaign.</p>
        </ConfirmDialog>
      )}

      {confirm?.kind === "script" && (
        <ConfirmDialog
          title="Delete saved script?"
          confirmLabel="Delete"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { handleDeletePrompt(confirm.item.id); setConfirm(null); }}
        >
          <p><strong>{confirm.item.title}</strong> will be permanently removed from your saved scripts.</p>
        </ConfirmDialog>
      )}

      {confirm?.kind === "sheet" && (
        <ConfirmDialog
          title="Remove saved sheet?"
          confirmLabel="Remove"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { handleDeleteSheet(confirm.item.id); setConfirm(null); }}
        >
          <p><strong>{confirm.item.label}</strong> will be removed from your saved sheets. The Google Sheet itself isn&apos;t affected.</p>
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
