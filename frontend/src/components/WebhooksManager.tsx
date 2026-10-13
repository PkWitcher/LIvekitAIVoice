"use client";

import { useState, useEffect, useCallback } from "react";
import { Webhook, Plus, Trash2, Copy, Check, ChevronDown } from "lucide-react";

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

interface Delivery {
  id: string;
  event: string;
  status_code: number | null;
  success: boolean;
  error: string | null;
  created_at: string;
}

const AVAILABLE_EVENTS = ["call.completed", "call.no_answer"];

export default function WebhooksManager() {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(AVAILABLE_EVENTS);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks");
      const data = await res.json();
      if (data.success) setWebhooks(data.webhooks ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  };

  const handleCreate = async () => {
    setError("");
    if (!/^https?:\/\/.+/.test(url.trim())) {
      setError("Enter a valid https:// URL");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events: selectedEvents }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to add webhook");
        return;
      }
      setUrl("");
      fetchWebhooks();
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (hook: WebhookRow) => {
    await fetch(`/api/webhooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !hook.is_active }),
    });
    fetchWebhooks();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const handleCopySecret = (hook: WebhookRow) => {
    navigator.clipboard.writeText(hook.secret);
    setCopiedId(hook.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = async (hook: WebhookRow) => {
    if (expandedId === hook.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(hook.id);
    const res = await fetch(`/api/webhooks/${hook.id}/deliveries`);
    const data = await res.json();
    if (data.success) setDeliveries(data.deliveries ?? []);
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <Webhook className="w-4 h-4 text-blue-400" />
        <h2 className="text-base font-semibold text-white">Webhooks</h2>
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)] -mt-2">
        Get a signed POST request (transcript, summary, disposition) whenever a call finishes — wire this into n8n, Make, Zapier, or your own CRM.
      </p>

      <div className="space-y-2">
        <input
          type="url"
          placeholder="https://your-n8n-instance.com/webhook/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_EVENTS.map((event) => (
            <button
              key={event}
              onClick={() => toggleEvent(event)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 ${
                selectedEvents.includes(event)
                  ? "bg-blue-600 text-white"
                  : "bg-white/[0.06] text-[var(--color-text-muted)] hover:bg-white/[0.1]"
              }`}
            >
              {event}
            </button>
          ))}
        </div>
        {error && <p className="text-[11px] text-red-400">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={creating || !url.trim()}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Webhook
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
      ) : webhooks.length === 0 ? (
        <p className="dash-empty-state">No webhooks configured yet.</p>
      ) : (
        <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
          {webhooks.map((hook) => (
            <div key={hook.id} className="rounded-lg bg-white/[0.04]">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{hook.url}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{hook.events.join(", ")}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleCopySecret(hook)}
                    className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-white transition-colors"
                    title="Copy signing secret"
                  >
                    {copiedId === hook.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleToggleActive(hook)}
                    className={`text-[10px] px-2 py-1 rounded-full font-medium ${hook.is_active ? "bg-green-500/10 text-green-400" : "bg-white/[0.06] text-[var(--color-text-muted)]"}`}
                  >
                    {hook.is_active ? "Active" : "Paused"}
                  </button>
                  <button
                    onClick={() => toggleExpand(hook)}
                    className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-white transition-colors"
                    title="Recent deliveries"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedId === hook.id ? "rotate-180" : ""}`} />
                  </button>
                  <button
                    onClick={() => handleDelete(hook.id)}
                    className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {expandedId === hook.id && (
                <div className="px-3 pb-2.5 space-y-1">
                  {deliveries.length === 0 ? (
                    <p className="text-[10px] text-[var(--color-text-muted)]">No deliveries yet.</p>
                  ) : (
                    deliveries.map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-[10px]">
                        <span className={d.success ? "text-green-400" : "text-red-400"}>
                          {d.event} — {d.status_code ?? d.error ?? "failed"}
                        </span>
                        <span className="text-[var(--color-text-muted)]">{new Date(d.created_at).toLocaleString("en-IN")}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
