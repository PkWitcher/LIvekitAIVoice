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

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0s";
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

  const totalMessages = calls.reduce((sum, c) => sum + c.message_count, 0);
  const uniquePhones = Object.keys(grouped).length;

  if (loading) {
    return (
      <div className="transcript-loading">
        <div className="spinner" />
        <p>Loading conversations...</p>
      </div>
    );
  }

  return (
    <>
      {/* Stats Bar */}
      <div className="transcript-stats-bar">
        <div className="transcript-stat-item">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
          </svg>
          <div>
            <span className="transcript-stat-value">{calls.length}</span>
            <span className="transcript-stat-label">Conversations</span>
          </div>
        </div>
        <div className="transcript-stat-item">
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <div>
            <span className="transcript-stat-value">{uniquePhones}</span>
            <span className="transcript-stat-label">Contacts</span>
          </div>
        </div>
        <div className="transcript-stat-item">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
          <div>
            <span className="transcript-stat-value">{totalMessages}</span>
            <span className="transcript-stat-label">Messages</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="transcript-card">
        {/* Search Header */}
        <div className="transcript-card-header">
          <div className="transcript-search-wrapper">
            <svg className="transcript-search-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search by phone number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="transcript-search-input"
            />
            {search && (
              <button onClick={() => setSearch("")} className="transcript-search-clear">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Empty State */}
        {Object.keys(grouped).length === 0 ? (
          <div className="transcript-empty">
            <div className="transcript-empty-icon">
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </div>
            <h3>{search.trim() ? "No results found" : "No conversations yet"}</h3>
            <p>{search.trim() ? "Try a different phone number" : "Make a call to see conversation transcripts here"}</p>
          </div>
        ) : (
          <div className="transcript-contacts-list">
            {Object.entries(grouped).map(([phone, phoneCalls]) => {
              const totalDuration = phoneCalls.reduce((s, c) => s + (c.duration_seconds || 0), 0);
              const totalMsgs = phoneCalls.reduce((s, c) => s + c.message_count, 0);
              const lastCall = phoneCalls[0];

              return (
                <div key={phone} className="transcript-contact-card">
                  {/* Contact Header */}
                  <div className="transcript-contact-header">
                    <div className="transcript-contact-avatar">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    </div>
                    <div className="transcript-contact-info">
                      <span className="transcript-contact-phone">{phone}</span>
                      <span className="transcript-contact-meta">
                        {phoneCalls.length} call{phoneCalls.length !== 1 ? "s" : ""} • {totalMsgs} messages • {formatDuration(totalDuration)} total
                      </span>
                    </div>
                    <span className="transcript-contact-date">
                      Last: {formatDate(lastCall.created_at)}
                    </span>
                  </div>

                  {/* Call Timeline */}
                  <div className="transcript-timeline">
                    {phoneCalls.map((call, idx) => (
                      <div key={call.room_name} className="transcript-timeline-item">
                        <div className="transcript-timeline-dot-wrapper">
                          <div className={`transcript-timeline-dot ${idx === 0 ? "latest" : ""}`} />
                          {idx < phoneCalls.length - 1 && <div className="transcript-timeline-line" />}
                        </div>
                        <div className="transcript-timeline-content">
                          <div className="transcript-timeline-row">
                            <span className="transcript-timeline-time">{formatTime(call.created_at)}</span>
                            <span className="transcript-timeline-duration">{formatDuration(call.duration_seconds)}</span>
                            <span className="transcript-timeline-msgs">{call.message_count} msgs</span>
                          </div>
                        </div>
                        <button
                          onClick={() => { setSelectedRoom(call.room_name); setShowTranscript(true); }}
                          className="transcript-view-btn"
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
