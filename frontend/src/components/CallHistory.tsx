"use client";

import { useEffect, useState, useCallback } from "react";

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

export default function CallHistory() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch("/api/calls");
      const data = await res.json();
      if (data.success) {
        setCalls(data.calls ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 1000);
    return () => clearInterval(interval);
  }, [fetchCalls]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString([], {
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

  const statusColor: Record<string, string> = {
    ringing: "text-yellow-400",
    initiated: "text-yellow-400",
    connected: "text-blue-400",
    completed: "text-green-400",
    "no-answer": "text-orange-400",
    failed: "text-red-400",
  };

  if (loading) {
    return (
      <div className="card p-8 text-center text-sm text-[var(--color-text-muted)]">
        Loading call history…
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          No calls yet. Dispatch a call to see history here.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <h2 className="text-sm sm:text-base font-semibold text-white">Call History</h2>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-[10px] sm:text-xs text-[var(--color-text-muted)]">
            {calls.length} call{calls.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={fetchCalls}
            className="text-[10px] sm:text-xs text-[var(--color-text-secondary)] hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Duration</th>
              <th className="px-5 py-3 font-medium">Model</th>
              <th className="px-5 py-3 font-medium">Voice</th>
              <th className="px-5 py-3 font-medium">Recording</th>
              <th className="px-5 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr
                key={call.id}
                className="border-t border-[var(--color-border)] hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-5 py-3 font-mono text-[var(--color-text-primary)]">
                  {call.phone_number}
                </td>
                <td className="px-5 py-3">
                  <span className={`capitalize ${statusColor[call.status] ?? "text-[var(--color-text-secondary)]"}`}>
                    {call.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-[var(--color-text-secondary)]">
                  {formatDuration(call.duration_seconds)}
                </td>
                <td className="px-5 py-3 text-[var(--color-text-secondary)] capitalize">
                  {call.model_provider}
                </td>
                <td className="px-5 py-3 text-[var(--color-text-secondary)]">
                  {(call.voice_id ?? "").replace("aura-", "").replace("-en", "")}
                </td>
                <td className="px-5 py-3">
                  {call.recording_url && call.status === "completed" ? (
                    <div className="flex items-center gap-2">
                      <audio controls preload="none" className="h-7 w-36">
                        <source src={call.recording_url} type="audio/ogg" />
                      </audio>
                      <a
                        href={`/api/recordings/${call.room_name}.ogg`}
                        download
                        className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--color-text-muted)] hover:text-blue-400 transition-colors"
                        title="Download recording"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      </a>
                    </div>
                  ) : (
                    <span className="text-[var(--color-text-muted)] text-xs">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-[var(--color-text-muted)]">
                  {formatTime(call.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="sm:hidden divide-y divide-[var(--color-border)]">
        {calls.map((call) => (
          <div key={call.id} className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-[var(--color-text-primary)]">
                {call.phone_number}
              </span>
              <span className={`text-xs capitalize ${statusColor[call.status] ?? ""}`}>
                {call.status}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
              <span>{formatDuration(call.duration_seconds)}</span>
              <span>{call.model_provider}</span>
              {call.recording_url && call.status === "completed" && (
                <a
                  href={`/api/recordings/${call.room_name}.ogg`}
                  download
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Download
                </a>
              )}
              <span className="ml-auto">{formatTime(call.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
