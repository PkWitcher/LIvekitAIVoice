"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Download, X, Bot, User, MessageSquare, ArrowDown } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import "@/styles/calls.css";

interface TranscriptMessage {
  id: string;
  speaker: "ai" | "user";
  text: string;
  created_at: string;
}

interface CallInfo {
  room_name: string;
  status: string;
  phone_number: string;
  duration_seconds: number | null;
  created_at: string;
}

interface LiveTranscriptProps {
  roomName: string | null;
  phoneNumber?: string;
  callStartedAt?: string;
  durationSeconds?: number | null;
  /** Force the live indicator on/off. When omitted it is derived from the call's status. */
  isLive?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const LIVE_STATUSES = new Set(["ringing", "initiated", "connected"]);
const STICK_THRESHOLD_PX = 80;

const formatClock = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const formatDuration = (seconds: number | null | undefined) => {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export default function LiveTranscript({
  roomName,
  phoneNumber,
  callStartedAt,
  durationSeconds,
  isLive,
  isOpen,
  onClose,
}: LiveTranscriptProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [unseen, setUnseen] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!roomName || !isOpen) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setMessages([]);
    setUnseen(0);
    stickRef.current = true;

    const fetchExisting = async () => {
      const { data, error } = await supabase
        .from("call_transcripts")
        .select("id, speaker, text, created_at")
        .eq("room_name", roomName)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) setLoadError("Could not load the transcript. Please try again.");
      else if (data) {
        // Realtime inserts may have landed while this request was in flight
        setMessages((prev) => {
          const seen = new Set(data.map((m) => m.id));
          return [...data, ...prev.filter((m) => !seen.has(m.id))];
        });
      }
      setLoading(false);
    };
    fetchExisting();
    return () => { cancelled = true; };
  }, [roomName, isOpen, supabase]);

  useEffect(() => {
    if (!roomName || !isOpen) return;

    const channel = supabase
      .channel(`transcript-${roomName}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_transcripts",
          filter: `room_name=eq.${roomName}`,
        },
        (payload) => {
          const newMsg = payload.new as TranscriptMessage;
          setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomName, isOpen, supabase]);

  // Call status drives the live indicator and fills in header details the caller didn't pass
  useEffect(() => {
    if (!roomName || !isOpen) return;
    let cancelled = false;
    setCallInfo(null);

    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/calls");
        const data = await res.json();
        if (cancelled || !Array.isArray(data.calls)) return;
        const match = data.calls.find((c: CallInfo) => c.room_name === roomName);
        if (match) setCallInfo(match);
      } catch { /* transient — next tick retries */ }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(id); };
  }, [roomName, isOpen]);

  const live = isLive ?? (callInfo ? LIVE_STATUSES.has(callInfo.status) : false);
  const phone = phoneNumber ?? callInfo?.phone_number;
  const startedAt = callStartedAt ?? callInfo?.created_at;
  const duration = durationSeconds ?? callInfo?.duration_seconds ?? null;

  // Only follow new messages while the reader is already at the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;
    if (stickRef.current) {
      el.scrollTo({ top: el.scrollHeight });
    } else {
      setUnseen((n) => n + 1);
    }
  }, [messages.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    stickRef.current = atBottom;
    if (atBottom) setUnseen(0);
  };

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    setUnseen(0);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const exportTranscript = () => {
    if (!roomName || messages.length === 0) return;

    const callDate = startedAt ? new Date(startedAt).toLocaleString("en-IN") : "Unknown";
    const content = [
      "CALL TRANSCRIPT",
      "=".repeat(48),
      `Phone: ${phone ?? "Unknown"}`,
      `Date: ${callDate}`,
      `Duration: ${formatDuration(duration)}`,
      `Reference: ${roomName}`,
      "",
      "CONVERSATION",
      "-".repeat(48),
      ...messages.map((message) => `[${formatClock(message.created_at)}] ${message.speaker === "ai" ? "AI" : "Customer"}: ${message.text}`),
      "",
      "Exported from Nova AI",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `call-transcript-${phone?.replace(/[^\d]/g, "") || roomName}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="cl2 cl2-portal">
      <div className="cl2-overlay cl2-overlay-side" onClick={onClose}>
        <div
          className="cl2-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Call transcript"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="cl2-drawer-head">
            <div className="cl2-drawer-title">
              <h3>
                Call transcript
                {live ? (
                  <span className="cl2-live" role="status">
                    <span className="cl2-live-dot" aria-hidden="true" /> Live
                  </span>
                ) : null}
              </h3>
              <p className="cl2-muted">
                {phone ? <span className="cl2-mono">{phone}</span> : "Call"}
                {startedAt ? ` · ${new Date(startedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                {!live && duration != null ? ` · ${formatDuration(duration)}` : ""}
              </p>
            </div>
            <div className="cl2-drawer-actions">
              <button
                type="button"
                className="cl2-icon-btn"
                onClick={exportTranscript}
                title="Download transcript"
                aria-label="Download transcript"
                disabled={messages.length === 0}
              >
                <Download size={15} />
              </button>
              <button
                type="button"
                ref={closeBtnRef}
                className="cl2-icon-btn"
                onClick={onClose}
                aria-label="Close transcript"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="cl2-chat-wrap">
            <div
              className="cl2-chat"
              ref={scrollRef}
              onScroll={handleScroll}
              role="log"
              aria-live="polite"
              aria-label="Conversation"
            >
              {loading && (
                <div className="cl2-chat-state">
                  <span className="cl2-spin" aria-hidden="true" />
                  <span>Loading transcript…</span>
                </div>
              )}

              {!loading && loadError && (
                <div className="cl2-chat-state cl2-text-danger" role="alert">
                  <span>{loadError}</span>
                </div>
              )}

              {!loading && !loadError && messages.length === 0 && (
                <div className="cl2-chat-state">
                  <MessageSquare size={28} aria-hidden="true" />
                  <strong>{live ? "Waiting for the conversation to start" : "No transcript available"}</strong>
                  <span className="cl2-muted">
                    {live
                      ? "Messages will appear here in real time as the call progresses."
                      : "This call has no recorded conversation — it may not have been answered."}
                  </span>
                </div>
              )}

              {messages.map((msg, i) => {
                const isAgent = msg.speaker === "ai";
                const grouped = i > 0 && messages[i - 1].speaker === msg.speaker;
                return (
                  <div key={msg.id} className={`cl2-bubble-row ${isAgent ? "is-agent" : "is-caller"}${grouped ? " is-grouped" : ""}`}>
                    {!grouped && (
                      <span className="cl2-bubble-who">
                        {isAgent ? <Bot size={12} aria-hidden="true" /> : <User size={12} aria-hidden="true" />}
                        {isAgent ? "Agent" : "Caller"}
                      </span>
                    )}
                    <div className="cl2-bubble">
                      <p>{msg.text}</p>
                      <time dateTime={msg.created_at}>{formatClock(msg.created_at)}</time>
                    </div>
                  </div>
                );
              })}
            </div>

            {unseen > 0 && (
              <button type="button" className="cl2-jump" onClick={jumpToLatest}>
                <ArrowDown size={13} aria-hidden="true" /> {unseen} new message{unseen !== 1 ? "s" : ""}
              </button>
            )}
          </div>

          <footer className="cl2-drawer-foot">
            <span className="cl2-muted">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
              {live ? " · updating live" : ""}
            </span>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  );
}
