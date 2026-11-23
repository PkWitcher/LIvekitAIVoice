"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

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
const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;

function toIso(d: Date): string {
  return d.toISOString().split("T")[0];
}

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addDays(iso: string, days: number): string {
  return toIso(new Date(parseIso(iso).getTime() + days * DAY_MS));
}

function formatShort(iso: string, withYear: boolean): string {
  return parseIso(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

function formatLong(iso: string): string {
  return parseIso(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function spanDays(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / DAY_MS) + 1;
}

export default function DashboardDateFilter({ from, to, onApply, onClear }: DashboardDateFilterProps) {
  const now = new Date();
  const todayIso = toIso(utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => (from ? parseIso(from).getUTCFullYear() : now.getUTCFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (from ? parseIso(from).getUTCMonth() : now.getUTCMonth()));
  const [selStart, setSelStart] = useState<string | null>(from);
  const [selEnd, setSelEnd] = useState<string | null>(to);
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [focusIso, setFocusIso] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const shouldFocusDay = useRef(false);

  const closePopover = (returnFocus: boolean) => {
    setOpen(false);
    setHoverIso(null);
    if (returnFocus) triggerRef.current?.focus();
  };

  const openPopover = () => {
    const start = from ?? null;
    setSelStart(start);
    setSelEnd(to ?? null);
    const anchor = start ?? todayIso;
    setViewYear(parseIso(anchor).getUTCFullYear());
    setViewMonth(parseIso(anchor).getUTCMonth());
    setFocusIso(anchor > todayIso ? todayIso : anchor);
    shouldFocusDay.current = true;
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        setHoverIso(null);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !shouldFocusDay.current || !focusIso) return;
    shouldFocusDay.current = false;
    popRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusIso}"]`)?.focus();
  }, [open, focusIso, viewMonth, viewYear]);

  const showMonthOf = (iso: string) => {
    const d = parseIso(iso);
    setViewYear(d.getUTCFullYear());
    setViewMonth(d.getUTCMonth());
  };

  const shiftMonth = (delta: number) => {
    const d = utcDate(viewYear, viewMonth + delta, 1);
    setViewYear(d.getUTCFullYear());
    setViewMonth(d.getUTCMonth());
  };

  const moveFocus = (iso: string) => {
    const next = iso > todayIso ? todayIso : iso;
    setFocusIso(next);
    showMonthOf(next);
    shouldFocusDay.current = true;
  };

  const handleDayClick = (iso: string) => {
    if (iso > todayIso) return;
    setFocusIso(iso);
    if (!selStart || selEnd) {
      setSelStart(iso);
      setSelEnd(null);
    } else if (iso < selStart) {
      setSelEnd(selStart);
      setSelStart(iso);
    } else {
      setSelEnd(iso);
    }
  };

  const handleDayKey = (e: React.KeyboardEvent, iso: string) => {
    const keyMap: Record<string, () => string> = {
      ArrowLeft: () => addDays(iso, -1),
      ArrowRight: () => addDays(iso, 1),
      ArrowUp: () => addDays(iso, -7),
      ArrowDown: () => addDays(iso, 7),
      Home: () => addDays(iso, -parseIso(iso).getUTCDay()),
      End: () => addDays(iso, 6 - parseIso(iso).getUTCDay()),
      PageUp: () => toIso(utcDate(parseIso(iso).getUTCFullYear(), parseIso(iso).getUTCMonth() - 1, parseIso(iso).getUTCDate())),
      PageDown: () => toIso(utcDate(parseIso(iso).getUTCFullYear(), parseIso(iso).getUTCMonth() + 1, parseIso(iso).getUTCDate())),
    };
    const handler = keyMap[e.key];
    if (!handler) return;
    e.preventDefault();
    moveFocus(handler());
  };

  const presets = useMemo(() => {
    const y = parseIso(todayIso).getUTCFullYear();
    const m = parseIso(todayIso).getUTCMonth();
    return [
      { label: "Today", from: todayIso, to: todayIso },
      { label: "Yesterday", from: addDays(todayIso, -1), to: addDays(todayIso, -1) },
      { label: "Last 7 days", from: addDays(todayIso, -6), to: todayIso },
      { label: "Last 30 days", from: addDays(todayIso, -29), to: todayIso },
      { label: "This month", from: toIso(utcDate(y, m, 1)), to: todayIso },
      { label: "Last month", from: toIso(utcDate(y, m - 1, 1)), to: toIso(utcDate(y, m, 0)) },
      { label: "This year", from: toIso(utcDate(y, 0, 1)), to: todayIso },
    ];
  }, [todayIso]);

  const applyPreset = (p: { from: string; to: string }) => {
    setSelStart(p.from);
    setSelEnd(p.to);
    onApply(p.from, p.to);
    closePopover(true);
  };

  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const firstWeekday = utcDate(viewYear, viewMonth, 1).getUTCDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toIso(utcDate(viewYear, viewMonth, i + 1))),
  ];
  const firstEnabled = cells.find((c): c is string => !!c && c <= todayIso) ?? null;
  const tabIso = focusIso && cells.includes(focusIso) ? focusIso : firstEnabled;

  const previewEnd = selStart && !selEnd && hoverIso ? hoverIso : null;
  const edge = selEnd ?? previewEnd ?? selStart;
  const rangeLo = selStart && edge ? (selStart < edge ? selStart : edge) : null;
  const rangeHi = selStart && edge ? (selStart < edge ? edge : selStart) : null;
  const isInRange = (iso: string) => !!rangeLo && !!rangeHi && iso >= rangeLo && iso <= rangeHi;
  const isEndpoint = (iso: string) => iso === selStart || iso === selEnd;

  const selDays = selStart ? spanDays(selStart, selEnd ?? selStart) : 0;
  const tooLong = Math.abs(selDays) > MAX_RANGE_DAYS;

  const label = from && to
    ? from === to
      ? formatShort(from, true)
      : `${formatShort(from, parseIso(from).getUTCFullYear() !== parseIso(to).getUTCFullYear())} – ${formatShort(to, true)}`
    : "Filter by date";

  const summaryText = !selStart
    ? "Select a start date"
    : !selEnd
      ? `${formatShort(selStart, true)} — select an end date or apply a single day`
      : `${formatShort(selStart, true)} – ${formatShort(selEnd, true)} · ${selDays} day${selDays === 1 ? "" : "s"}`;

  const years = Array.from({ length: 6 }, (_, i) => now.getUTCFullYear() - i);
  if (!years.includes(viewYear)) years.push(viewYear);
  years.sort((a, b) => b - a);

  const atMaxMonth = viewYear === now.getUTCFullYear() && viewMonth >= now.getUTCMonth();

  return (
    <div
      className="dh2-df"
      ref={containerRef}
      onBlur={(e) => {
        if (open && e.relatedTarget && !containerRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closePopover(false) : openPopover())}
        className={`dh2-icon-btn dh2-df-trigger ${from && to ? "has-value" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Filter dashboard by date. Current range: ${label}`}
        title="Filter dashboard by date"
      >
        <Calendar size={16} aria-hidden="true" />
        <span className="dash-date-filter-label dh2-df-label">{label}</span>
        <ChevronDown size={13} className={`dh2-df-caret ${open ? "open" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div ref={popRef} className="dh2-df-pop" role="dialog" aria-label="Choose a date range">
          <div className="dh2-df-presets" role="group" aria-label="Quick ranges">
            {presets.map((p) => {
              const active = from === p.from && to === p.to;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`dh2-df-chip ${active ? "active" : ""}`}
                  aria-pressed={active}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="dh2-df-nav">
            <button type="button" onClick={() => shiftMonth(-1)} className="dh2-df-navbtn" aria-label="Previous month">
              <ChevronLeft size={15} />
            </button>
            <div className="dh2-df-selects">
              <select value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))} aria-label="Month">
                {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))} aria-label="Year">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => shiftMonth(1)} className="dh2-df-navbtn" aria-label="Next month" disabled={atMaxMonth}>
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="dh2-df-weekdays" aria-hidden="true">
            {WEEKDAY_LABELS.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div
            className="dh2-df-days"
            role="group"
            aria-label={`${MONTH_NAMES[viewMonth]} ${viewYear}`}
            onMouseLeave={() => setHoverIso(null)}
          >
            {cells.map((iso, i) => {
              if (!iso) return <span key={i} className="dh2-df-blank" />;
              const future = iso > todayIso;
              const endpoint = isEndpoint(iso);
              const inRange = isInRange(iso);
              const cls = [
                "dh2-df-day",
                endpoint ? "endpoint" : "",
                inRange && !endpoint ? "in-range" : "",
                iso === todayIso ? "today" : "",
                iso === rangeLo ? "range-start" : "",
                iso === rangeHi ? "range-end" : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={iso}
                  type="button"
                  data-iso={iso}
                  disabled={future}
                  tabIndex={iso === tabIso ? 0 : -1}
                  className={cls}
                  onClick={() => handleDayClick(iso)}
                  onKeyDown={(e) => handleDayKey(e, iso)}
                  onMouseEnter={() => setHoverIso(iso)}
                  onFocus={() => setHoverIso(iso)}
                  aria-label={formatLong(iso)}
                  aria-pressed={endpoint}
                >
                  {Number(iso.split("-")[2])}
                </button>
              );
            })}
          </div>

          <p className={`dh2-df-summary ${tooLong ? "warn" : ""}`} aria-live="polite">
            {tooLong ? `Ranges are limited to ${MAX_RANGE_DAYS} days.` : summaryText}
          </p>

          <div className="dh2-df-footer">
            {(from || to) ? (
              <button
                type="button"
                onClick={() => { setSelStart(null); setSelEnd(null); onClear(); closePopover(true); }}
                className="dh2-df-clear"
              >
                Clear filter
              </button>
            ) : <span />}
            <div className="dh2-df-footer-actions">
              <button type="button" className="dh2-btn dh2-btn-secondary dh2-btn-sm" onClick={() => closePopover(true)}>
                Cancel
              </button>
              <button
                type="button"
                className="dh2-btn dh2-btn-primary dh2-btn-sm"
                disabled={!selStart || tooLong}
                onClick={() => {
                  if (!selStart) return;
                  const end = selEnd ?? selStart;
                  const lo = selStart < end ? selStart : end;
                  const hi = selStart < end ? end : selStart;
                  onApply(lo, hi);
                  closePopover(true);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
