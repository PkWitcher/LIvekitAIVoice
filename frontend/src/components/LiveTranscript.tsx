"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";

interface TranscriptMessage {
  id: string;
  speaker: "ai" | "user";
  text: string;
  created_at: string;
}

interface LiveTranscriptProps {
  roomName: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function LiveTranscript({ roomName, isOpen, onClose }: LiveTranscriptProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Fetch existing messages when room opens
  useEffect(() => {
    if (!roomName || !isOpen) return;
    setLoading(true);
    setMessages([]);

    const fetchExisting = async () => {
      const { data } = await supabase
        .from("call_transcripts")
        .select("id, speaker, text, created_at")
        .eq("room_name", roomName)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
      setLoading(false);
    };
    fetchExisting();
  }, [roomName, isOpen, supabase]);

  // Subscribe to realtime updates
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
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomName, isOpen, supabase]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="live-transcript-overlay" onClick={onClose}>
      <div className="live-transcript-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="live-transcript-header">
          <div className="flex items-center gap-2">
            <div className="live-transcript-dot" />
            <h3 className="text-sm font-semibold text-white">Live Transcript</h3>
          </div>
          <div className="flex items-center gap-2">
            {roomName && (
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                {roomName.substring(0, 20)}...
              </span>
            )}
            <button onClick={onClose} className="live-transcript-close">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="live-transcript-messages" ref={scrollRef}>
          {loading && (
            <div className="live-transcript-loading">
              <span className="spinner" style={{ width: 14, height: 14 }} />
              <span>Loading transcript...</span>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="live-transcript-empty">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="opacity-30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
              <p>Waiting for conversation to start...</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`live-transcript-msg ${msg.speaker === "ai" ? "ai" : "user"}`}
            >
              <div className="live-transcript-msg-header">
                <span className={`live-transcript-speaker ${msg.speaker}`}>
                  {msg.speaker === "ai" ? "🤖 AI" : "👤 Customer"}
                </span>
                <span className="live-transcript-time">{formatTime(msg.created_at)}</span>
              </div>
              <p className="live-transcript-text">{msg.text}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="live-transcript-footer">
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {messages.length} message{messages.length !== 1 ? "s" : ""} • Auto-saved
          </span>
        </div>
      </div>
    </div>
  );
}
