"use client";

import { useEffect, useState, useCallback } from "react";
import LiveTranscript from "@/components/LiveTranscript";

interface TranscriptCall {
  room_name: string;
  phone_number: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
  message_count: number;
}

export default function TranscriptHistory() {
  const [calls, setCalls] = useState<TranscriptCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch("/api/transcripts");
      const data = await res.json();
      if (data.success) setCalls(data.calls ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Group calls by phone number
  const grouped: Record<string, TranscriptCall[]> = {};
  const filtered = search.trim()
    ? calls.filter((c) => c.phone_number.includes(search.trim()))
    : calls;

  for (const call of filtered) {
    const phone = call.phone_number;
    if (!grouped[phone]) grouped[phone] = [];
    grouped[phone].push(call);
  }

  if (loading) {
    return (
      <div className="card p-8 text-center text-sm text-[var(--color-text-muted)]">
        Loading transcripts...
      </div>
    );
  }

  return (
    <>
      <div className="card p-0 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm sm:text-base font-semibold text-white">Transcript History</h2>
            <span className="text-[10px] sm:text-xs text-[var(--color-text-muted)]">
              {calls.length} conversation{calls.length !== 1 ? "s" : ""}
            </span>
          </div>
          {/* Search by phone */}
          <input
            type="text"
            placeholder="Search by phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!py-1.5 !text-xs w-full"
          />
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="p-8 text-center">
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="mx-auto mb-2 opacity-20">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
            <p className="text-sm text-[var(--color-text-muted)]">
              {search.trim() ? "No transcripts found for this number" : "No transcripts yet. Make a call to see conversations here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {Object.entries(grouped).map(([phone, phoneCalls]) => (
              <div key={phone} className="px-4 sm:px-5 py-3">
                {/* Phone header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                  </div>
                  <span className="font-mono text-sm font-medium text-white">{phone}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {phoneCalls.length} call{phoneCalls.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Calls for this phone */}
                <div className="ml-9 space-y-1.5">
                  {phoneCalls.map((call) => (
                    <div
                      key={call.room_name}
                      className="flex items-center justify-between py-1.5 group"
                    >
                      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                        <span>{formatTime(call.created_at)}</span>
                        <span>{formatDuration(call.duration_seconds)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/15">
                          {call.message_count} msgs
                        </span>
                      </div>
                      <button
                        onClick={() => { setSelectedRoom(call.room_name); setShowTranscript(true); }}
                        className="text-[10px] px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors opacity-70 group-hover:opacity-100"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transcript Sidebar */}
      <LiveTranscript
        roomName={selectedRoom}
        isOpen={showTranscript}
        onClose={() => setShowTranscript(false)}
      />
    </>
  );
}
