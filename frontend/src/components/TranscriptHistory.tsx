"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  MessageSquare,
  Users,
  Clock,
  Search,
  Eye,
  Copy,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  TriangleAlert,
  Phone,
  FileText,
} from "lucide-react";
import LiveTranscript from "@/components/LiveTranscript";
import { createClient } from "@/lib/supabase-browser";
import { useToast, copyText, fmtDateTime, fmtNumber } from "@/components/ai2-ui";

interface TranscriptCall {
  room_name: string;
  phone_number: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
  message_count: number;
}

interface TranscriptMessage {
  id: string;
  speaker: "ai" | "user";
  text: string;
  created_at: string;
}

type DateRange = "all" | "today" | "7d" | "30d" | "custom";
type SortKey = "newest" | "oldest" | "longest" | "messages";
type ViewMode = "calls" | "contacts";

const PAGE_SIZE = 10;

const formatDuration = (seconds: number | null | undefined) => {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatPhone = (phone: string) => {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone.replace(/\s/g, ""));
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export default function TranscriptHistory() {
  const [calls, setCalls] = useState<TranscriptCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("calls");
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<TranscriptCall | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const { push, node: toastNode } = useToast();

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch("/api/transcripts");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not load transcripts");
      setCalls(data.calls ?? []);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load transcripts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/\s+/g, "");
    const now = new Date();
    let min = -Infinity;
    let max = Infinity;
    if (range === "today") min = startOfDay(now);
    else if (range === "7d") min = startOfDay(now) - 6 * 86400000;
    else if (range === "30d") min = startOfDay(now) - 29 * 86400000;
    else if (range === "custom") {
      if (from) min = new Date(`${from}T00:00:00`).getTime();
      if (to) max = new Date(`${to}T23:59:59.999`).getTime();
    }
    const list = calls.filter((c) => {
      const t = new Date(c.created_at).getTime();
      if (t < min || t > max) return false;
      if (!q) return true;
      return c.phone_number.replace(/\s/g, "").toLowerCase().includes(q) || c.room_name.toLowerCase().includes(q);
    });
    return list.sort((a, b) => {
      if (sortKey === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortKey === "longest") return (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0);
      if (sortKey === "messages") return b.message_count - a.message_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [calls, search, range, from, to, sortKey]);

  const contacts = useMemo(() => {
    const map = new Map<string, { phone: string; calls: number; messages: number; duration: number; last: string }>();
    for (const c of filtered) {
      const row = map.get(c.phone_number) ?? { phone: c.phone_number, calls: 0, messages: 0, duration: 0, last: c.created_at };
      row.calls += 1;
      row.messages += c.message_count;
      row.duration += c.duration_seconds ?? 0;
      if (new Date(c.created_at) > new Date(row.last)) row.last = c.created_at;
      map.set(c.phone_number, row);
    }
    return [...map.values()].sort((a, b) => new Date(b.last).getTime() - new Date(a.last).getTime());
  }, [filtered]);

  const totalMessages = filtered.reduce((s, c) => s + c.message_count, 0);
  const totalDuration = filtered.reduce((s, c) => s + (c.duration_seconds ?? 0), 0);

  const rows = view === "calls" ? filtered : contacts;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, rows.length);
  const filtersActive = search.trim() !== "" || range !== "all";

  const resetFilters = () => {
    setSearch("");
    setRange("all");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const buildTranscriptText = (call: TranscriptCall, messages: TranscriptMessage[]) =>
    [
      "CALL TRANSCRIPT",
      "=".repeat(48),
      `Phone: ${call.phone_number}`,
      `Date: ${fmtDateTime(call.created_at)}`,
      `Duration: ${formatDuration(call.duration_seconds)}`,
      `Reference: ${call.room_name}`,
      "",
      "-".repeat(48),
      "",
      ...messages.map((m) => {
        const time = new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        return `[${time}] ${m.speaker === "ai" ? "Agent" : "Customer"}: ${m.text}`;
      }),
      "",
    ].join("\n");

  const loadTranscriptText = async (call: TranscriptCall) => {
    const { data, error } = await supabase
      .from("call_transcripts")
      .select("id, speaker, text, created_at")
      .eq("room_name", call.room_name)
      .order("created_at", { ascending: true });
    if (error || !data) throw new Error("Could not load this transcript");
    if (data.length === 0) throw new Error("This call has no transcript messages");
    return buildTranscriptText(call, data as TranscriptMessage[]);
  };

  const handleCopy = async (call: TranscriptCall) => {
    setBusyAction(`copy:${call.room_name}`);
    try {
      const text = await loadTranscriptText(call);
      if (await copyText(text)) push("Transcript copied to clipboard");
      else push("Couldn’t copy to the clipboard", "error");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not copy transcript", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownload = async (call: TranscriptCall) => {
    setBusyAction(`dl:${call.room_name}`);
    try {
      const text = await loadTranscriptText(call);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const stamp = new Date(call.created_at).toISOString().slice(0, 16).replace(/[-:T]/g, "");
      const a = document.createElement("a");
      a.href = href;
      a.download = `transcript-${call.phone_number.replace(/\D/g, "")}-${stamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
      push("Transcript downloaded");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not download transcript", "error");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="ai2 ai2-page">
      <div className="ai2-kpis">
        <div className="ai2-kpi">
          <span className="ai2-kpi-label">Conversations</span>
          <span className="ai2-kpi-value">{fmtNumber(filtered.length)}</span>
          <span className="ai2-kpi-sub">{filtersActive ? `of ${fmtNumber(calls.length)} total` : "completed calls with transcripts"}</span>
        </div>
        <div className="ai2-kpi">
          <span className="ai2-kpi-label">Contacts</span>
          <span className="ai2-kpi-value">{fmtNumber(contacts.length)}</span>
          <span className="ai2-kpi-sub">unique phone numbers</span>
        </div>
        <div className="ai2-kpi">
          <span className="ai2-kpi-label">Messages</span>
          <span className="ai2-kpi-value">{fmtNumber(totalMessages)}</span>
          <span className="ai2-kpi-sub">{filtered.length > 0 ? `${(totalMessages / filtered.length).toFixed(1)} per conversation` : "—"}</span>
        </div>
        <div className="ai2-kpi">
          <span className="ai2-kpi-label">Talk time</span>
          <span className="ai2-kpi-value">{formatDuration(totalDuration)}</span>
          <span className="ai2-kpi-sub">{filtered.length > 0 ? `${formatDuration(Math.round(totalDuration / filtered.length))} average` : "—"}</span>
        </div>
      </div>

      <section className="ai2-panel">
        <div className="ai2-panel-head">
          <div className="ai2-panel-title">
            <span className="ai2-panel-icon"><MessageSquare /></span>
            <div>
              <h2>Transcripts</h2>
              <p>Read, copy or download what was said on every completed call.</p>
            </div>
          </div>
          <div className="ai2-segment ai2-segment-compact" role="group" aria-label="View mode">
            <button type="button" className={view === "calls" ? "is-on" : ""} aria-pressed={view === "calls"} onClick={() => { setView("calls"); setPage(1); }}>
              <Phone /> Calls
            </button>
            <button type="button" className={view === "contacts" ? "is-on" : ""} aria-pressed={view === "contacts"} onClick={() => { setView("contacts"); setPage(1); }}>
              <Users /> Contacts
            </button>
          </div>
        </div>

        <div className="ai2-toolbar">
          <label className="ai2-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by phone number or reference"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              aria-label="Search transcripts"
            />
          </label>
          <select value={range} onChange={(e) => { setRange(e.target.value as DateRange); setPage(1); }} aria-label="Date range">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom range…</option>
          </select>
          {range === "custom" && (
            <>
              <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" className="ai2-date" />
              <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" className="ai2-date" />
            </>
          )}
          {view === "calls" && (
            <select value={sortKey} onChange={(e) => { setSortKey(e.target.value as SortKey); setPage(1); }} aria-label="Sort conversations">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="longest">Longest first</option>
              <option value="messages">Most messages</option>
            </select>
          )}
          <span className="ai2-count">
            {rows.length === 0 ? "0 results" : `${pageStart + 1}–${pageEnd} of ${fmtNumber(rows.length)}`}
          </span>
        </div>

        {loading ? (
          <div className="ai2-panel-body ai2-stack" aria-busy="true" aria-label="Loading transcripts">
            {[0, 1, 2, 3].map((i) => <div key={i} className="ai2-skeleton ai2-skeleton-row" />)}
          </div>
        ) : loadError ? (
          <div className="ai2-empty">
            <span className="ai2-empty-icon ai2-empty-icon-warn"><TriangleAlert /></span>
            <h3>Couldn’t load transcripts</h3>
            <p>{loadError}</p>
            <button type="button" className="ai2-btn" onClick={() => { setLoading(true); fetchCalls(); }}><RefreshCw /> Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="ai2-empty">
            <span className="ai2-empty-icon"><FileText /></span>
            {filtersActive ? (
              <>
                <h3>No conversations match your filters</h3>
                <p>Try a different phone number or widen the date range.</p>
                <button type="button" className="ai2-btn" onClick={resetFilters}>Clear filters</button>
              </>
            ) : (
              <>
                <h3>No conversations yet</h3>
                <p>Transcripts appear here once a call has finished and the conversation was recorded.</p>
              </>
            )}
          </div>
        ) : view === "calls" ? (
          <div className="ai2-table-wrap">
            <table className="ai2-table">
              <thead>
                <tr>
                  <th scope="col">Date &amp; time</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Messages</th>
                  <th scope="col" className="ai2-th-right"><span className="ai2-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {(filtered as TranscriptCall[]).slice(pageStart, pageEnd).map((call) => (
                  <tr key={call.room_name}>
                    <td>{fmtDateTime(call.created_at)}</td>
                    <td>
                      <button type="button" className="ai2-link ai2-phone" onClick={() => { setSearch(call.phone_number); setPage(1); }} title="Filter to this contact">
                        {formatPhone(call.phone_number)}
                      </button>
                    </td>
                    <td><Clock className="ai2-inline-icon" /> {formatDuration(call.duration_seconds)}</td>
                    <td>{call.message_count}</td>
                    <td className="ai2-td-right">
                      <div className="ai2-row-actions">
                        <button type="button" className="ai2-btn ai2-btn-sm" onClick={() => setSelectedCall(call)}>
                          <Eye /> View
                        </button>
                        <button
                          type="button"
                          className="ai2-icon-btn"
                          aria-label={`Copy transcript for ${call.phone_number}`}
                          title="Copy transcript"
                          disabled={busyAction === `copy:${call.room_name}`}
                          onClick={() => handleCopy(call)}
                        >
                          {busyAction === `copy:${call.room_name}` ? <span className="ai2-spin" aria-hidden="true" /> : <Copy />}
                        </button>
                        <button
                          type="button"
                          className="ai2-icon-btn"
                          aria-label={`Download transcript for ${call.phone_number}`}
                          title="Download as .txt"
                          disabled={busyAction === `dl:${call.room_name}`}
                          onClick={() => handleDownload(call)}
                        >
                          {busyAction === `dl:${call.room_name}` ? <span className="ai2-spin" aria-hidden="true" /> : <Download />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ai2-table-wrap">
            <table className="ai2-table">
              <thead>
                <tr>
                  <th scope="col">Contact</th>
                  <th scope="col">Calls</th>
                  <th scope="col">Messages</th>
                  <th scope="col">Total talk time</th>
                  <th scope="col">Last call</th>
                  <th scope="col" className="ai2-th-right"><span className="ai2-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {contacts.slice(pageStart, pageEnd).map((c) => (
                  <tr key={c.phone}>
                    <td><span className="ai2-cell-strong">{formatPhone(c.phone)}</span></td>
                    <td>{c.calls}</td>
                    <td>{c.messages}</td>
                    <td>{formatDuration(c.duration)}</td>
                    <td>{fmtDateTime(c.last)}</td>
                    <td className="ai2-td-right">
                      <button type="button" className="ai2-btn ai2-btn-sm" onClick={() => { setSearch(c.phone); setView("calls"); setPage(1); }}>
                        View calls
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !loadError && rows.length > PAGE_SIZE && (
          <nav className="ai2-pager" aria-label="Pagination">
            <span>Page {currentPage} of {totalPages}</span>
            <div>
              <button type="button" className="ai2-btn ai2-btn-sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>
                <ChevronLeft /> Previous
              </button>
              <button type="button" className="ai2-btn ai2-btn-sm" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>
                Next <ChevronRight />
              </button>
            </div>
          </nav>
        )}
      </section>

      <LiveTranscript
        roomName={selectedCall?.room_name ?? null}
        phoneNumber={selectedCall?.phone_number}
        callStartedAt={selectedCall?.created_at}
        durationSeconds={selectedCall?.duration_seconds}
        isOpen={selectedCall !== null}
        onClose={() => setSelectedCall(null)}
      />

      {toastNode}
    </div>
  );
}
