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
    <div className="card space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Bulk Campaign</h2>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 font-medium">
          Batch
        </span>
      </div>

      {/* Numbers */}
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="bulk-numbers">Phone Numbers</label>
          {parsedCount > 0 && (
            <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
              {parsedCount} number{parsedCount !== 1 ? "s" : ""}
            </span>
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
        className="w-full py-2.5 rounded-lg font-medium text-sm text-white
                   bg-green-600 hover:bg-green-500
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors duration-150 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="spinner" />
            Launching…
          </>
        ) : (
          <>Launch Campaign{parsedCount > 0 ? ` (${parsedCount})` : ""}</>
        )}
      </button>

      {/* Progress bar */}
      {loading && (
        <div className="w-full h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full animate-progress-bar" />
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
          {/* Summary */}
          <div className="flex items-center gap-4 text-xs">
            <span className="text-green-400">{dispatched} dispatched</span>
            {failed > 0 && <span className="text-red-400">{failed} failed</span>}
            <span className="ml-auto text-[var(--color-text-muted)]">
              {Math.round((dispatched / results.length) * 100)}% success
            </span>
          </div>

          {/* Result list */}
          <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
                  r.status === "dispatched"
                    ? "bg-green-500/5 text-green-400"
                    : "bg-red-500/5 text-red-400"
                }`}
              >
                <span className="font-mono">{r.phone}</span>
                <span className="opacity-70">
                  {r.status === "dispatched" ? "Dispatched" : r.error ?? "Failed"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
      )}
    </div>
  );
}
