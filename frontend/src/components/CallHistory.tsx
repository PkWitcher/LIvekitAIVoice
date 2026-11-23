"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Fragment } from "react";
import {
  Search,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  PhoneCall,
  Headphones,
  MessageSquare,
  CircleAlert,
  X,
} from "lucide-react";
import LiveTranscript from "@/components/LiveTranscript";
import "@/styles/calls.css";

interface CallLog {
  id: string;
  phone_number: string;
  direction: string;
  status: string;
  duration_seconds: number | null;
  room_name: string | null;
  model_provider: string;
  voice_id: string;
  prompt: string | null;
  error: string | null;
  created_at: string;
  ended_at: string | null;
  recording_url: string | null;
}

type SortKey = "created_at" | "phone_number" | "status" | "duration_seconds";
type SortDir = "asc" | "desc";
type RangeKey = "all" | "today" | "7d" | "30d";

const PAGE_SIZE = 10;
const REFRESH_MS = 5000;
const LIVE_STATUSES = new Set(["ringing", "initiated", "connected"]);

const STATUS_META: Record<string, { label: string; tone: string }> = {
  initiated: { label: "Initiated", tone: "warn" },
  ringing: { label: "Ringing", tone: "warn" },
  connected: { label: "In progress", tone: "info" },
  completed: { label: "Completed", tone: "ok" },
  "no-answer": { label: "No answer", tone: "orange" },
  failed: { label: "Failed", tone: "danger" },
};

const STATUS_FILTERS = ["completed", "connected", "ringing", "no-answer", "failed"];

const VOICE_NAMES: Record<string, string> = {
  "4877b818-c7fe-4c89-b1cf-eadf8e23da72": "Rohan (Hindi, male)",
  "0f14d8cb-f039-41fe-a813-a9b4bee7eed8": "Hindi, female",
  "1259b7e3-cb8a-43df-9446-30971a46b8b0": "English",
  RABOvaPec1ymXz02oDQi: "Indian voice 1",
  czQ9pLzjRaF61EAYjcPC: "Indian voice 2",
  "aura-asteria-en": "Asteria",
  "aura-orion-en": "Orion",
};

const MODEL_NAMES: Record<string, string> = { openai: "OpenAI", groq: "Groq", anthropic: "Anthropic", google: "Google", gemini: "Gemini" };

const titleCase = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const statusMeta = (status: string) => STATUS_META[status] ?? { label: titleCase(status || "unknown"), tone: "muted" };

const voiceLabel = (id: string | null) => {
  if (!id) return "—";
  if (VOICE_NAMES[id]) return VOICE_NAMES[id];
  return /^[0-9a-f-]{30,}$/i.test(id) ? `${id.slice(0, 8)}…` : titleCase(id);
};

const modelLabel = (m: string | null) => (m ? MODEL_NAMES[m.toLowerCase()] ?? titleCase(m) : "—");

const formatDuration = (seconds: number | null | undefined) => {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  if (total === 0) return "0s";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatWhen = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  });
};

const rangeStart = (range: RangeKey): number => {
  const now = new Date();
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (range === "7d") return now.getTime() - 7 * 86_400_000;
  if (range === "30d") return now.getTime() - 30 * 86_400_000;
  return 0;
};

const csvCell = (value: string | number | null | undefined) => {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const getRecordingFile = (call: CallLog): string | null => {
  if (call.room_name) return `${call.room_name}.ogg`;
  if (call.recording_url) {
    const parts = call.recording_url.split("/");
    return parts[parts.length - 1] || null;
  }
  return null;
};

const hasRecording = (call: CallLog) => !!call.recording_url && call.status === "completed" && !!getRecordingFile(call);
const hasTranscript = (call: CallLog) =>
  !!call.room_name && (call.status === "completed" || LIVE_STATUSES.has(call.status));

function StatusPill({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span className={`cl2-pill cl2-pill-${meta.tone}`}>
      <span className="cl2-pill-dot" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export default function CallHistory() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [transcriptCall, setTranscriptCall] = useState<CallLog | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [range, setRange] = useState<RangeKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchCalls = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch("/api/calls");
      const data = await res.json();
      if (data.success) {
        setCalls(data.calls ?? []);
        setError("");
        setLastUpdated(new Date());
        hasLoadedRef.current = true;
      } else {
        setError(data.error || "Could not load call history");
      }
    } catch {
      setError("Network error — could not reach the server");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(() => {
      if (!document.hidden) fetchCalls();
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchCalls]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/[^\d]/g, "");
    const since = rangeStart(range);
    const rows = calls.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (since && new Date(c.created_at).getTime() < since) return false;
      if (q) {
        const phone = (c.phone_number ?? "").toLowerCase();
        const digits = phone.replace(/[^\d]/g, "");
        if (!phone.includes(q) && !(qDigits && digits.includes(qDigits))) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === "duration_seconds") cmp = (a.duration_seconds ?? -1) - (b.duration_seconds ?? -1);
      else cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
      return cmp * dir;
    });
  }, [calls, search, statusFilter, range, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const completed = filtered.filter((c) => c.status === "completed");
    const timed = completed.filter((c) => c.duration_seconds != null);
    const talk = timed.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0);
    const unanswered = filtered.filter((c) => c.status === "no-answer" || c.status === "failed").length;
    return {
      total: filtered.length,
      completed: completed.length,
      unanswered,
      avg: timed.length ? talk / timed.length : null,
      talk,
    };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtersActive = search.trim() !== "" || statusFilter !== "all" || range !== "all";

  const resetPage = () => setPage(1);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "created_at" || key === "duration_seconds" ? "desc" : "asc");
    }
    resetPage();
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setRange("all");
    resetPage();
  };

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const header = ["Phone", "Status", "Duration (seconds)", "Duration", "Model", "Voice", "Started", "Ended", "Reference", "Error"];
    const lines = filtered.map((c) =>
      [
        c.phone_number,
        statusMeta(c.status).label,
        c.duration_seconds ?? "",
        formatDuration(c.duration_seconds),
        modelLabel(c.model_provider),
        voiceLabel(c.voice_id),
        c.created_at ? new Date(c.created_at).toISOString() : "",
        c.ended_at ? new Date(c.ended_at).toISOString() : "",
        c.room_name ?? "",
        c.error ?? "",
      ].map(csvCell).join(",")
    );
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortHead = (label: string, k: SortKey) => (
    <th
      scope="col"
      aria-sort={sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" className="cl2-th-btn" onClick={() => toggleSort(k)}>
        {label}
        {sortKey === k ? (
          sortDir === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />
        ) : (
          <ArrowUpDown size={12} className="cl2-th-idle" aria-hidden="true" />
        )}
      </button>
    </th>
  );

  const renderTranscriptBtn = (call: CallLog) => {
    if (!hasTranscript(call)) return null;
    const live = LIVE_STATUSES.has(call.status);
    return (
      <button
        type="button"
        className={`cl2-btn cl2-btn-sm ${live ? "cl2-btn-live" : ""}`}
        onClick={() => setTranscriptCall(call)}
      >
        {live ? <span className="cl2-live-dot" aria-hidden="true" /> : <MessageSquare size={13} aria-hidden="true" />}
        {live ? "Live transcript" : "Transcript"}
      </button>
    );
  };

  const renderDetail = (call: CallLog) => {
    const file = getRecordingFile(call);
    return (
      <div className="cl2-detail">
        <dl className="cl2-detail-grid">
          <div><dt>Status</dt><dd><StatusPill status={call.status} /></dd></div>
          <div><dt>Started</dt><dd>{formatWhen(call.created_at)}</dd></div>
          <div><dt>Ended</dt><dd>{call.ended_at ? formatWhen(call.ended_at) : LIVE_STATUSES.has(call.status) ? "In progress" : "—"}</dd></div>
          <div><dt>Talk time</dt><dd>{formatDuration(call.duration_seconds)}</dd></div>
          <div><dt>Model</dt><dd>{modelLabel(call.model_provider)}</dd></div>
          <div><dt>Voice</dt><dd>{voiceLabel(call.voice_id)}</dd></div>
          <div><dt>Direction</dt><dd>{titleCase(call.direction || "outbound")}</dd></div>
          <div><dt>Reference</dt><dd className="cl2-mono cl2-break">{call.room_name ?? "—"}</dd></div>
        </dl>

        {call.error && (
          <div className="cl2-alert cl2-alert-danger" role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            <span>{call.error}</span>
          </div>
        )}

        {hasRecording(call) && file && (
          <div className="cl2-detail-block">
            <span className="cl2-label">Recording</span>
            <div className="cl2-audio-row">
              <audio controls preload="none" aria-label={`Recording for ${call.phone_number}`}>
                <source src={`/api/recordings/${file}`} type="audio/mpeg" />
              </audio>
              <a className="cl2-btn cl2-btn-sm" href={`/api/recordings/${file}?download=1`}>
                <Download size={13} aria-hidden="true" /> Download
              </a>
            </div>
          </div>
        )}

        {call.prompt && (
          <details className="cl2-detail-block">
            <summary className="cl2-label">Script used</summary>
            <pre className="cl2-script">{call.prompt}</pre>
          </details>
        )}

        <div className="cl2-detail-actions">{renderTranscriptBtn(call)}</div>
      </div>
    );
  };

  if (loading) {
    return (
      <section className="cl2 cl2-panel" aria-busy="true" aria-label="Call history">
        <div className="cl2-panel-head">
          <h2 className="cl2-title">Call history</h2>
        </div>
        <div className="cl2-skeleton-list" aria-label="Loading call history">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="cl2-skeleton" />)}
        </div>
      </section>
    );
  }

  if (error && !hasLoadedRef.current) {
    return (
      <section className="cl2 cl2-panel" aria-label="Call history">
        <div className="cl2-panel-head"><h2 className="cl2-title">Call history</h2></div>
        <div className="cl2-empty" role="alert">
          <CircleAlert size={34} aria-hidden="true" />
          <strong>Couldn&apos;t load call history</strong>
          <span>{error}</span>
          <button type="button" className="cl2-btn cl2-btn-primary" onClick={() => fetchCalls(true)}>
            <RefreshCw size={14} aria-hidden="true" /> Try again
          </button>
        </div>
      </section>
    );
  }

  if (calls.length === 0) {
    return (
      <section className="cl2 cl2-panel" aria-label="Call history">
        <div className="cl2-panel-head"><h2 className="cl2-title">Call history</h2></div>
        <div className="cl2-empty">
          <PhoneCall size={34} aria-hidden="true" />
          <strong>No calls yet</strong>
          <span>Place a single call or launch a campaign above — every call will show up here with its status, recording and transcript.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="cl2 cl2-panel cl2-flush" aria-label="Call history">
      <div className="cl2-panel-head cl2-pad">
        <div>
          <h2 className="cl2-title">Call history</h2>
          <p className="cl2-muted">
            Your {calls.length >= 50 ? "50 most recent calls" : `${calls.length} call${calls.length !== 1 ? "s" : ""}`}
            {lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
          </p>
        </div>
        <div className="cl2-head-actions">
          <button type="button" className="cl2-btn" onClick={() => fetchCalls(true)} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "cl2-rotate" : ""} aria-hidden="true" /> Refresh
          </button>
          <button type="button" className="cl2-btn" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download size={14} aria-hidden="true" /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="cl2-alert cl2-alert-warn cl2-alert-flush" role="status">
          <CircleAlert size={15} aria-hidden="true" />
          <span>Live refresh is having trouble ({error}). Showing the last loaded data.</span>
        </div>
      )}

      <div className="cl2-kpis cl2-pad">
        <div className="cl2-kpi"><span className="cl2-kpi-label">Calls</span><span className="cl2-kpi-value">{kpis.total.toLocaleString("en-IN")}</span><span className="cl2-kpi-sub">{filtersActive ? "matching filters" : "in this list"}</span></div>
        <div className="cl2-kpi"><span className="cl2-kpi-label">Completed</span><span className="cl2-kpi-value">{kpis.completed.toLocaleString("en-IN")}</span><span className="cl2-kpi-sub">{kpis.total ? `${Math.round((kpis.completed / kpis.total) * 100)}% of calls` : "—"}</span></div>
        <div className="cl2-kpi"><span className="cl2-kpi-label">No answer / failed</span><span className="cl2-kpi-value">{kpis.unanswered.toLocaleString("en-IN")}</span><span className="cl2-kpi-sub">{kpis.total ? `${Math.round((kpis.unanswered / kpis.total) * 100)}% of calls` : "—"}</span></div>
        <div className="cl2-kpi"><span className="cl2-kpi-label">Avg. talk time</span><span className="cl2-kpi-value">{kpis.avg == null ? "—" : formatDuration(kpis.avg)}</span><span className="cl2-kpi-sub">{kpis.talk ? `${formatDuration(kpis.talk)} total` : "completed calls"}</span></div>
      </div>

      <div className="cl2-toolbar cl2-pad" role="search">
        <div className="cl2-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            className="cl2-input"
            placeholder="Search by phone number…"
            aria-label="Search calls by phone number"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          />
        </div>
        <select
          className="cl2-input cl2-select-auto"
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}
        >
          <option value="all">All statuses</option>
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}
        </select>
        <div className="cl2-seg" role="group" aria-label="Date range">
          {([["all", "All time"], ["today", "Today"], ["7d", "7 days"], ["30d", "30 days"]] as [RangeKey, string][]).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={range === k ? "is-active" : ""}
              aria-pressed={range === k}
              onClick={() => { setRange(k); resetPage(); }}
            >
              {label}
            </button>
          ))}
        </div>
        {filtersActive && (
          <button type="button" className="cl2-btn cl2-btn-ghost cl2-btn-sm" onClick={clearFilters}>
            <X size={13} aria-hidden="true" /> Clear
          </button>
        )}
        <span className="cl2-count" aria-live="polite">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="cl2-empty">
          <Search size={34} aria-hidden="true" />
          <strong>No calls match your filters</strong>
          <span>Try a different phone number, status or date range.</span>
          <button type="button" className="cl2-btn" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : (
        <>
          <div className="cl2-table-wrap cl2-hide-md">
            <table className="cl2-table">
              <thead>
                <tr>
                  <th className="cl2-th-chevron" aria-label="Expand" />
                  {sortHead("Phone", "phone_number")}
                  {sortHead("Status", "status")}
                  {sortHead("Duration", "duration_seconds")}
                  <th scope="col">Model</th>
                  <th scope="col">Voice</th>
                  {sortHead("Time", "created_at")}
                  <th scope="col" className="cl2-th-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((call) => {
                  const open = expandedId === call.id;
                  const live = LIVE_STATUSES.has(call.status);
                  return (
                    <Fragment key={call.id}>
                      <tr className={open ? "is-open" : ""}>
                        <td>
                          <button
                            type="button"
                            className="cl2-icon-btn cl2-chevron"
                            aria-expanded={open}
                            aria-label={`${open ? "Hide" : "Show"} details for ${call.phone_number}`}
                            onClick={() => setExpandedId(open ? null : call.id)}
                          >
                            <ChevronDown size={15} className={open ? "is-open" : ""} aria-hidden="true" />
                          </button>
                        </td>
                        <td className="cl2-mono cl2-strong">{call.phone_number}</td>
                        <td><StatusPill status={call.status} /></td>
                        <td>{live ? <span className="cl2-muted">In progress</span> : formatDuration(call.duration_seconds)}</td>
                        <td>{modelLabel(call.model_provider)}</td>
                        <td>{voiceLabel(call.voice_id)}</td>
                        <td className="cl2-nowrap">{formatWhen(call.created_at)}</td>
                        <td className="cl2-td-right">
                          <div className="cl2-row-actions">
                            {hasRecording(call) && (
                              <button
                                type="button"
                                className="cl2-icon-btn"
                                title="Listen to recording"
                                aria-label={`Listen to recording for ${call.phone_number}`}
                                onClick={() => setExpandedId(call.id)}
                              >
                                <Headphones size={15} aria-hidden="true" />
                              </button>
                            )}
                            {renderTranscriptBtn(call)}
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="cl2-expanded">
                          <td colSpan={8}>{renderDetail(call)}</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="cl2-cards">
            {pageRows.map((call) => {
              const open = expandedId === call.id;
              return (
                <div key={call.id} className="cl2-card-item">
                  <button
                    type="button"
                    className="cl2-card-head"
                    aria-expanded={open}
                    onClick={() => setExpandedId(open ? null : call.id)}
                  >
                    <span className="cl2-mono cl2-strong">{call.phone_number}</span>
                    <StatusPill status={call.status} />
                  </button>
                  <div className="cl2-card-meta">
                    <span>{LIVE_STATUSES.has(call.status) ? "In progress" : formatDuration(call.duration_seconds)}</span>
                    <span>{modelLabel(call.model_provider)}</span>
                    <span className="cl2-card-time">{formatWhen(call.created_at)}</span>
                  </div>
                  {open && renderDetail(call)}
                </div>
              );
            })}
          </div>

          <div className="cl2-pagination cl2-pad">
            <span>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="cl2-pagination-btns">
              <button type="button" className="cl2-btn cl2-btn-sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page">
                <ChevronLeft size={14} aria-hidden="true" /> Prev
              </button>
              <span className="cl2-page-indicator">Page {currentPage} of {pageCount}</span>
              <button type="button" className="cl2-btn cl2-btn-sm" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)} aria-label="Next page">
                Next <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}

      <LiveTranscript
        roomName={transcriptCall?.room_name ?? null}
        phoneNumber={transcriptCall?.phone_number}
        callStartedAt={transcriptCall?.created_at}
        durationSeconds={transcriptCall?.duration_seconds}
        isOpen={transcriptCall !== null}
        onClose={() => setTranscriptCall(null)}
      />
    </section>
  );
}
