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
  const [progress, setProgress] = useState(0);

  const parsedCount = numbers
    .split(/[\n,]+/)
    .map((n) => n.trim())
    .filter(Boolean).length;

  const handleLaunch = async () => {
    const parsed = numbers
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (parsed.length === 0) return;
    setLoading(true);
    setResults([]);
    setProgress(0);

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
      setProgress(100);
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
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-teal-500/20 flex items-center justify-center border border-green-500/10">
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
            <h2 className="text-lg font-semibold text-white">Bulk Campaign</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Reach multiple contacts at once
            </p>
          </div>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium uppercase tracking-wider">
          Batch
        </span>
      </div>

      {/* Numbers */}
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="bulk-numbers">Phone Numbers</label>
          {parsedCount > 0 && (
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{parsedCount} number{parsedCount !== 1 ? "s" : ""}</span>
          )}
        </div>
        <textarea
          id="bulk-numbers"
          rows={4}
          placeholder={"9876543210\n8765432100\n7654321000\n\nSeparate by newline or comma"}
          value={numbers}
          onChange={(e) => setNumbers(e.target.value)}
          className="font-mono text-xs"
        />
      </div>

      {/* Campaign Context */}
      <div>
        <label htmlFor="bulk-context">Campaign Script</label>
        <input
          id="bulk-context"
          type="text"
          placeholder="e.g. Appointment reminder for June 20 at 3 PM"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleLaunch}
        disabled={loading || !numbers.trim()}
        className="w-full py-3 rounded-xl font-semibold text-sm text-white
                   bg-gradient-to-r from-green-600 to-teal-600
                   hover:from-green-500 hover:to-teal-500
                   hover:shadow-lg hover:shadow-green-500/20
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-300 flex items-center justify-center gap-2
                   active:scale-[0.98]"
      >
        {loading ? (
          <>
            <span className="spinner" />
            Launching Campaign…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Launch Campaign{parsedCount > 0 ? ` (${parsedCount})` : ""}
          </>
        )}
      </button>

      {/* Progress bar during loading */}
      {loading && (
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-400 to-teal-400 rounded-full animate-progress-bar" />
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3 pt-2">
          {/* Summary */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-400 font-semibold">{dispatched} dispatched</span>
            </div>
            {failed > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-red-400 font-semibold">{failed} failed</span>
              </div>
            )}
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {Math.round((dispatched / results.length) * 100)}% success
            </span>
          </div>

          {/* Result list */}
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between text-xs px-3 py-2.5 rounded-lg border transition-all ${
                  r.status === "dispatched"
                    ? "bg-green-500/5 border-green-500/15 text-green-300"
                    : "bg-red-500/5 border-red-500/15 text-red-300"
                }`}
              >
                <span className="font-mono">{r.phone}</span>
                <span className="flex items-center gap-1.5 opacity-80">
                  {r.status === "dispatched" ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    <span className="text-[10px]">{r.error ?? "Failed"}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
