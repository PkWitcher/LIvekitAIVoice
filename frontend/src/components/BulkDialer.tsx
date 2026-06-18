"use client";

import { useState } from "react";

interface DialResult {
  phone: string;
  status: "dispatched" | "failed";
  room_name?: string;
  error?: string;
}

export default function BulkDialer() {
  const [numbers, setNumbers] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DialResult[]>([]);

  const handleLaunch = async () => {
    const parsed = numbers
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (parsed.length === 0) return;
    setLoading(true);
    setResults([]);

    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_numbers: parsed,
          prompt: context.trim(),
        }),
      });

      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([
        { phone: "all", status: "failed", error: "Network error — check server" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const dispatched = results.filter((r) => r.status === "dispatched").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return (
    <div className="glass-card glow-green-teal p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-teal-500/20 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Bulk Dialer</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Launch a campaign to multiple numbers
          </p>
        </div>
      </div>

      {/* Numbers */}
      <div>
        <label htmlFor="bulk-numbers">Phone Numbers (CSV or newline)</label>
        <textarea
          id="bulk-numbers"
          rows={4}
          placeholder={"+919876543210\n+918765432100\n+917654321000"}
          value={numbers}
          onChange={(e) => setNumbers(e.target.value)}
        />
      </div>

      {/* Campaign Context */}
      <div>
        <label htmlFor="bulk-context">Campaign Context</label>
        <input
          id="bulk-context"
          type="text"
          placeholder="e.g. Appointment reminder for June 20"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleLaunch}
        disabled={loading || !numbers.trim()}
        className="w-full py-2.5 rounded-lg font-medium text-sm text-white
                   bg-gradient-to-r from-green-600 to-teal-600
                   hover:from-green-500 hover:to-teal-500
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-200 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="spinner" />
            Launching Campaign…
          </>
        ) : (
          "Launch Campaign"
        )}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-3 text-xs font-medium">
            <span className="text-green-400">{dispatched} dispatched</span>
            {failed > 0 && (
              <span className="text-red-400">{failed} failed</span>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between text-xs px-3 py-2 rounded-md border ${
                  r.status === "dispatched"
                    ? "bg-green-500/5 border-green-500/20 text-green-300"
                    : "bg-red-500/5 border-red-500/20 text-red-300"
                }`}
              >
                <span className="font-mono">{r.phone}</span>
                <span className="opacity-70">
                  {r.status === "dispatched" ? "✓" : `✕ ${r.error ?? ""}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
