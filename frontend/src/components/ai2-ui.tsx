"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X, CircleCheck, CircleAlert, Info } from "lucide-react";
import "@/styles/agents-integrations.css";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback((text: string, kind: ToastKind = "success") => {
    const id = ++idRef.current;
    setItems((prev) => [...prev.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const node = (
    <div className="ai2-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`ai2-toast ai2-toast-${t.kind}`}>
          {t.kind === "success" ? <CircleCheck /> : t.kind === "error" ? <CircleAlert /> : <Info />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );

  return { push, node };
}

// Only the top-most modal reacts to Escape / Tab so stacked dialogs behave
const modalStack: number[] = [];
let modalSeq = 0;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface ModalProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  dismissOnBackdrop?: boolean;
}

export function Modal({ title, subtitle, icon, onClose, children, footer, size = "md", dismissOnBackdrop = true }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const id = ++modalSeq;
    modalStack.push(id);
    const el = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => (el ? Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)) : []);

    const target = el?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? el;
    target?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== id) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const idx = modalStack.indexOf(id);
      if (idx >= 0) modalStack.splice(idx, 1);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="ai2-overlay"
      onMouseDown={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className={`ai2-modal ai2-modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="ai2-modal-head">
          {icon && <span className="ai2-modal-icon">{icon}</span>}
          <div className="ai2-modal-titles">
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="ai2-icon-btn" onClick={onClose} aria-label="Close dialog">
            <X />
          </button>
        </div>
        <div className="ai2-modal-body">{children}</div>
        {footer && <div className="ai2-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, tone = "danger", busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal
      size="sm"
      title={title}
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button type="button" className="ai2-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`ai2-btn ${tone === "danger" ? "ai2-btn-danger" : "ai2-btn-primary"}`}
            onClick={onConfirm}
            disabled={busy}
            data-autofocus
          >
            {busy && <span className="ai2-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="ai2-confirm-text">{message}</div>
    </Modal>
  );
}

type PillTone = "green" | "amber" | "gray" | "red" | "violet" | "blue";

export function Pill({ tone, dot = false, children }: { tone: PillTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`ai2-pill ai2-pill-${tone}`}>
      {dot && <i className="ai2-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

const parse = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const fmtDate = (iso?: string | null) => {
  const d = parse(iso);
  return d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
};

export const fmtDateTime = (iso?: string | null) => {
  const d = parse(iso);
  return d
    ? d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
};

export const relTime = (iso?: string | null) => {
  const d = parse(iso);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return fmtDate(iso);
};

export const fmtNumber = (n: number) => n.toLocaleString("en-IN");

export const fmtBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
