"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface DashboardDateFilterProps {
  from: string | null; // yyyy-mm-dd
  to: string | null;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function toIso(d: Date): string {
  return d.toISOString().split("T")[0];
}

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

export default function DashboardDateFilter({ from, to, onApply, onClear }: DashboardDateFilterProps) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const [viewYear, setViewYear] = useState(from ? new Date(from).getUTCFullYear() : today.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(from ? new Date(from).getUTCMonth() : today.getUTCMonth());
  const [selStart, setSelStart] = useState<string | null>(from);
  const [selEnd, setSelEnd] = useState<string | null>(to);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const goPrevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else { setViewMonth((m) => m - 1); }
  }, [viewMonth]);
  const goNextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else { setViewMonth((m) => m + 1); }
  }, [viewMonth]);

  const handleDayClick = (iso: string) => {
    if (!selStart || (selStart && selEnd)) {
      setSelStart(iso);
      setSelEnd(null);
    } else if (iso < selStart) {
      setSelEnd(selStart);
      setSelStart(iso);
    } else {
      setSelEnd(iso);
    }
  };

  const applyQuickRange = (s: Date, e: Date) => {
    const fIso = toIso(s);
    const tIso = toIso(e);
    setSelStart(fIso);
    setSelEnd(tIso);
    onApply(fIso, tIso);
    setOpen(false);
  };

  const quickRanges: { label: string; range: () => [Date, Date] }[] = [
    { label: "Today", range: () => { const d = utcDate(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()); return [d, d]; } },
    { label: "This Month", range: () => [utcDate(today.getUTCFullYear(), today.getUTCMonth(), 1), utcDate(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())] },
    { label: "Last Month", range: () => [utcDate(today.getUTCFullYear(), today.getUTCMonth() - 1, 1), new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))] },
    { label: "This Year", range: () => [utcDate(today.getUTCFullYear(), 0, 1), utcDate(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())] },
  ];

  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const firstWeekday = utcDate(viewYear, viewMonth, 1).getUTCDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toIso(utcDate(viewYear, viewMonth, i + 1))),
  ];

  const isInRange = (iso: string) => !!selStart && !!selEnd && iso >= selStart && iso <= selEnd;
  const isEndpoint = (iso: string) => iso === selStart || iso === selEnd;

  const label = from && to
    ? from === to
      ? new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : `${new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(to).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
    : "Filter by date";

  const years = Array.from({ length: 6 }, (_, i) => today.getUTCFullYear() - i);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="dash-icon-btn flex items-center gap-1.5 !w-auto !px-3"
        title="Filter dashboard by date"
      >
        <Calendar className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[300px] rounded-xl border shadow-2xl z-50 p-3"
          style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)" }}
        >
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b" style={{ borderColor: "var(--color-border)" }}>
            {quickRanges.map((q) => (
              <button
                key={q.label}
                onClick={() => { const [s, e] = q.range(); applyQuickRange(s, e); }}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors hover:text-white"
                style={{ background: "var(--color-bg-input)", color: "var(--color-text-secondary)" }}
              >
                {q.label}
              </button>
            ))}
            {(from || to) && (
              <button
                onClick={() => { setSelStart(null); setSelEnd(null); onClear(); setOpen(false); }}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium text-red-400 transition-colors"
                style={{ background: "var(--color-bg-input)" }}
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-1 mb-2">
            <button onClick={goPrevMonth} className="p-1 rounded hover:bg-white/[0.06]" aria-label="Previous month">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex gap-1">
              <select value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))} className="!py-1 !text-[11px] !px-1.5">
                {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))} className="!py-1 !text-[11px] !px-1.5">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={goNextMonth} className="p-1 rounded hover:bg-white/[0.06]" aria-label="Next month">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] mb-1" style={{ color: "var(--color-text-muted)" }}>
            {WEEKDAY_LABELS.map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((iso, i) => (
              <button
                key={i}
                disabled={!iso}
                onClick={() => iso && handleDayClick(iso)}
                className="aspect-square rounded-md text-[11px] transition-colors"
                style={{
                  visibility: iso ? "visible" : "hidden",
                  background: iso && isEndpoint(iso) ? "var(--color-accent)" : iso && isInRange(iso) ? "rgba(96,165,250,0.15)" : "transparent",
                  color: iso && isEndpoint(iso) ? "#fff" : "var(--color-text-secondary)",
                }}
              >
                {iso ? Number(iso.split("-")[2]) : ""}
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
            <button
              onClick={() => { if (selStart) { onApply(selStart, selEnd ?? selStart); setOpen(false); } }}
              disabled={!selStart}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-40 transition-colors"
              style={{ background: "var(--color-accent)" }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
