"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Webhook,
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  RefreshCw,
  TriangleAlert,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { Modal, ConfirmDialog, Pill, useToast, copyText, fmtDate, fmtDateTime } from "@/components/ai2-ui";

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

interface DeliveryState {
  loading: boolean;
  error: string;
  items: Delivery[];
}

const AVAILABLE_EVENTS = [
  { id: "call.completed", description: "A call finished — includes transcript, summary and disposition" },
  { id: "call.no_answer", description: "A call went unanswered" },
];

const isValidWebhookUrl = (value: string) => {
  try {
    const u = new URL(value);
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
};

const maskSecret = (secret: string) => `${secret.slice(0, 4)}${"•".repeat(16)}`;

const VERIFY_SNIPPET = `// Node.js — verify the raw request body
const crypto = require("crypto");
const expected = crypto.createHmac("sha256", WEBHOOK_SECRET)
  .update(rawBody).digest("hex");
const valid = expected === req.headers["x-nova-signature"];`;

export default function WebhooksManager() {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(AVAILABLE_EVENTS.map((e) => e.id));
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<WebhookRow | null>(null);

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, DeliveryState>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [verifyCopied, setVerifyCopied] = useState(false);

  const { push, node: toastNode } = useToast();

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not load webhooks");
      setWebhooks(data.webhooks ?? []);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load webhooks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const openCreate = () => {
    setUrl("");
    setSelectedEvents(AVAILABLE_EVENTS.map((e) => e.id));
    setFormError("");
    setCreated(null);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreated(null);
  };

  const toggleEvent = (event: string) => {
    setFormError("");
    setSelectedEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));
  };

  const handleCreate = async () => {
    const trimmed = url.trim();
    if (!isValidWebhookUrl(trimmed)) {
      setFormError("Enter a valid https:// endpoint URL");
      return;
    }
    if (selectedEvents.length === 0) {
      setFormError("Select at least one event to subscribe to");
      return;
    }
    if (webhooks.some((w) => w.url === trimmed)) {
      setFormError("You already have an endpoint with this URL");
      return;
    }
    setCreating(true);
    setFormError("");
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, events: selectedEvents }),
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error || "Failed to add webhook");
        return;
      }
      setCreated(data.webhook);
      fetchWebhooks();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (hook: WebhookRow) => {
    const next = !hook.is_active;
    setTogglingId(hook.id);
    setWebhooks((prev) => prev.map((w) => (w.id === hook.id ? { ...w, is_active: next } : w)));
    try {
      const res = await fetch(`/api/webhooks/${hook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not update webhook");
      push(next ? "Endpoint enabled" : "Endpoint paused — no events will be sent");
    } catch (err) {
      setWebhooks((prev) => prev.map((w) => (w.id === hook.id ? { ...w, is_active: hook.is_active } : w)));
      push(err instanceof Error ? err.message : "Could not update webhook", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/webhooks/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not delete webhook");
      setWebhooks((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      push("Endpoint deleted");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not delete webhook", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleCopySecret = async (hook: Pick<WebhookRow, "id" | "secret">) => {
    const ok = await copyText(hook.secret);
    if (!ok) {
      push("Couldn’t copy automatically — reveal the secret and copy it manually", "error");
      return;
    }
    setCopiedId(hook.id);
    setTimeout(() => setCopiedId((cur) => (cur === hook.id ? null : cur)), 2000);
  };

  const loadDeliveries = async (hookId: string) => {
    setDeliveries((prev) => ({ ...prev, [hookId]: { loading: true, error: "", items: prev[hookId]?.items ?? [] } }));
    try {
      const res = await fetch(`/api/webhooks/${hookId}/deliveries`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not load deliveries");
      setDeliveries((prev) => ({ ...prev, [hookId]: { loading: false, error: "", items: data.deliveries ?? [] } }));
    } catch (err) {
      setDeliveries((prev) => ({
        ...prev,
        [hookId]: { loading: false, error: err instanceof Error ? err.message : "Could not load deliveries", items: [] },
      }));
    }
  };

  const toggleExpand = (hook: WebhookRow) => {
    if (expandedId === hook.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(hook.id);
    loadDeliveries(hook.id);
  };

  const handleCopyVerify = async () => {
    if (await copyText(VERIFY_SNIPPET)) {
      setVerifyCopied(true);
      setTimeout(() => setVerifyCopied(false), 2000);
    }
  };

  const activeCount = webhooks.filter((w) => w.is_active).length;

  return (
    <div className="ai2 ai2-page">
      <section className="ai2-panel">
        <div className="ai2-panel-head">
          <div className="ai2-panel-title">
            <span className="ai2-panel-icon ai2-panel-icon-blue"><Webhook /></span>
            <div>
              <h2>Webhooks</h2>
              <p>
                Receive a signed POST (transcript, summary, disposition) when a call ends.
                {webhooks.length > 0 && <> {activeCount} of {webhooks.length} endpoint{webhooks.length === 1 ? "" : "s"} active.</>}
              </p>
            </div>
          </div>
          <button type="button" className="ai2-btn ai2-btn-primary" onClick={openCreate}>
            <Plus /> Add endpoint
          </button>
        </div>

        <div className="ai2-panel-body">
          {loading ? (
            <div className="ai2-stack" aria-busy="true">
              {[0, 1].map((i) => <div key={i} className="ai2-skeleton ai2-skeleton-card" />)}
            </div>
          ) : loadError ? (
            <div className="ai2-empty">
              <span className="ai2-empty-icon ai2-empty-icon-warn"><TriangleAlert /></span>
              <h3>Couldn’t load webhooks</h3>
              <p>{loadError}</p>
              <button type="button" className="ai2-btn" onClick={() => { setLoading(true); fetchWebhooks(); }}><RefreshCw /> Retry</button>
            </div>
          ) : webhooks.length === 0 ? (
            <div className="ai2-empty">
              <span className="ai2-empty-icon"><Webhook /></span>
              <h3>No webhook endpoints yet</h3>
              <p>Add an HTTPS endpoint to push call results into n8n, Make, Zapier or your CRM in real time.</p>
              <button type="button" className="ai2-btn ai2-btn-primary" onClick={openCreate}><Plus /> Add endpoint</button>
            </div>
          ) : (
            <ul className="ai2-hook-list">
              {webhooks.map((hook) => {
                const isOpen = expandedId === hook.id;
                const state = deliveries[hook.id];
                const shown = revealed[hook.id];
                return (
                  <li key={hook.id} className={`ai2-hook${hook.is_active ? "" : " is-paused"}`}>
                    <div className="ai2-hook-main">
                      <div className="ai2-hook-info">
                        <div className="ai2-hook-url-row">
                          <code className="ai2-hook-url" title={hook.url}>{hook.url}</code>
                          {hook.is_active ? <Pill tone="green" dot>Active</Pill> : <Pill tone="gray" dot>Paused</Pill>}
                        </div>
                        <div className="ai2-chips">
                          {hook.events.map((ev) => <span key={ev} className="ai2-chip ai2-chip-mono">{ev}</span>)}
                          <span className="ai2-chip-meta">Added {fmtDate(hook.created_at)}</span>
                        </div>
                      </div>
                      <div className="ai2-hook-actions">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={hook.is_active}
                          aria-label={`${hook.is_active ? "Pause" : "Enable"} endpoint ${hook.url}`}
                          className={`ai2-switch${hook.is_active ? " is-on" : ""}`}
                          onClick={() => handleToggleActive(hook)}
                          disabled={togglingId === hook.id}
                        >
                          <i />
                        </button>
                        <button type="button" className="ai2-icon-btn ai2-icon-btn-danger" aria-label={`Delete endpoint ${hook.url}`} title="Delete" onClick={() => setDeleteTarget(hook)}>
                          <Trash2 />
                        </button>
                      </div>
                    </div>

                    <div className="ai2-hook-secret">
                      <span className="ai2-hook-secret-label">Signing secret</span>
                      <code>{shown ? hook.secret : maskSecret(hook.secret)}</code>
                      <button
                        type="button"
                        className="ai2-icon-btn"
                        aria-label={shown ? "Hide signing secret" : "Reveal signing secret"}
                        title={shown ? "Hide" : "Reveal"}
                        onClick={() => setRevealed((prev) => ({ ...prev, [hook.id]: !prev[hook.id] }))}
                      >
                        {shown ? <EyeOff /> : <Eye />}
                      </button>
                      <button type="button" className="ai2-icon-btn" aria-label="Copy signing secret" title="Copy" onClick={() => handleCopySecret(hook)}>
                        {copiedId === hook.id ? <Check /> : <Copy />}
                      </button>
                      <button
                        type="button"
                        className="ai2-link ai2-hook-toggle"
                        onClick={() => toggleExpand(hook)}
                        aria-expanded={isOpen}
                      >
                        Recent deliveries <ChevronDown className={isOpen ? "is-open" : ""} />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="ai2-hook-deliveries">
                        <div className="ai2-hook-deliveries-head">
                          <span>Last 10 delivery attempts</span>
                          <button type="button" className="ai2-link" onClick={() => loadDeliveries(hook.id)} disabled={state?.loading}>
                            <RefreshCw className={state?.loading ? "ai2-rotate" : ""} /> Refresh
                          </button>
                        </div>
                        {!state || (state.loading && state.items.length === 0) ? (
                          <div className="ai2-stack">
                            {[0, 1].map((i) => <div key={i} className="ai2-skeleton ai2-skeleton-row" />)}
                          </div>
                        ) : state.error ? (
                          <p className="ai2-error">{state.error}</p>
                        ) : state.items.length === 0 ? (
                          <p className="ai2-hint">No deliveries yet. Attempts appear here after the next matching call event.</p>
                        ) : (
                          <div className="ai2-table-wrap">
                            <table className="ai2-table ai2-table-compact">
                              <thead>
                                <tr>
                                  <th scope="col">Event</th>
                                  <th scope="col">Result</th>
                                  <th scope="col">Status code</th>
                                  <th scope="col">Time</th>
                                </tr>
                              </thead>
                              <tbody>
                                {state.items.map((d) => (
                                  <tr key={d.id}>
                                    <td><code className="ai2-code-inline">{d.event}</code></td>
                                    <td>{d.success ? <Pill tone="green" dot>Delivered</Pill> : <Pill tone="red" dot>Failed</Pill>}</td>
                                    <td>
                                      {d.status_code ?? <span className="ai2-muted" title={d.error ?? undefined}>{d.error ?? "No response"}</span>}
                                    </td>
                                    <td>{fmtDateTime(d.created_at)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="ai2-panel">
        <div className="ai2-panel-head">
          <div className="ai2-panel-title">
            <span className="ai2-panel-icon"><Terminal /></span>
            <div>
              <h2>Verify signatures</h2>
              <p>Every request carries <code>X-Nova-Event</code> and an HMAC-SHA256 <code>X-Nova-Signature</code> of the raw JSON body.</p>
            </div>
          </div>
          <button type="button" className="ai2-btn" onClick={handleCopyVerify}>
            {verifyCopied ? <Check /> : <Copy />} {verifyCopied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="ai2-panel-body">
          <pre className="ai2-code" tabIndex={0} aria-label="Signature verification example"><code>{VERIFY_SNIPPET}</code></pre>
        </div>
      </section>

      {createOpen && (
        <Modal
          size="md"
          title={created ? "Endpoint added" : "Add webhook endpoint"}
          subtitle={created ? "Use the signing secret to verify incoming requests." : "We’ll POST call events to this URL."}
          icon={<Webhook />}
          onClose={closeCreate}
          footer={
            created ? (
              <button type="button" className="ai2-btn ai2-btn-primary" onClick={closeCreate} data-autofocus>Done</button>
            ) : (
              <>
                <button type="button" className="ai2-btn" onClick={closeCreate}>Cancel</button>
                <button type="button" className="ai2-btn ai2-btn-primary" onClick={handleCreate} disabled={creating}>
                  {creating && <span className="ai2-spin" aria-hidden="true" />}
                  {creating ? "Adding…" : "Add endpoint"}
                </button>
              </>
            )
          }
        >
          {created ? (
            <div className="ai2-stack">
              <p className="ai2-confirm-text"><code className="ai2-code-inline">{created.url}</code> will now receive {created.events.join(", ")} events.</p>
              <div className="ai2-alert ai2-alert-warn" role="note">
                <ShieldAlert />
                <span>Keep the signing secret private. You can reveal it again from the endpoint list.</span>
              </div>
              <div className="ai2-secret">
                <code>{created.secret}</code>
                <button type="button" className="ai2-btn ai2-btn-sm" onClick={() => handleCopySecret(created)}>
                  {copiedId === created.id ? <Check /> : <Copy />} {copiedId === created.id ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="ai2-stack">
              <div className="ai2-field">
                <label htmlFor="webhook-url">Endpoint URL</label>
                <input
                  id="webhook-url"
                  type="url"
                  placeholder="https://your-n8n-instance.com/webhook/..."
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setFormError(""); }}
                  className={formError && !isValidWebhookUrl(url.trim()) ? "is-invalid" : ""}
                  data-autofocus
                />
                <p className="ai2-hint">Must be a public HTTPS URL that responds with a 2xx status within 8 seconds.</p>
              </div>
              <fieldset className="ai2-field ai2-fieldset">
                <legend>Events</legend>
                <div className="ai2-check-list">
                  {AVAILABLE_EVENTS.map((ev) => (
                    <label key={ev.id} className={`ai2-check${selectedEvents.includes(ev.id) ? " is-on" : ""}`}>
                      <input type="checkbox" checked={selectedEvents.includes(ev.id)} onChange={() => toggleEvent(ev.id)} />
                      <span className="ai2-check-box" aria-hidden="true"><Check /></span>
                      <span>
                        <strong>{ev.id}</strong>
                        <em>{ev.description}</em>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {formError && <p className="ai2-error" role="alert">{formError}</p>}
            </form>
          )}
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this endpoint?"
          message={<>Events will stop being sent to <code className="ai2-code-inline">{deleteTarget.url}</code> and its delivery history will be removed.</>}
          confirmLabel="Delete endpoint"
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {toastNode}
    </div>
  );
}
