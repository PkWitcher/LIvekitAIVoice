"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { KeyRound, Plus, Trash2, Copy, Check, Search, TriangleAlert, RefreshCw, Terminal, ShieldAlert } from "lucide-react";
import { Modal, ConfirmDialog, Pill, useToast, copyText, fmtDate, fmtDateTime, relTime } from "@/components/ai2-ui";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked: boolean;
  created_at: string;
}

const NAME_MAX = 60;
const noopSubscribe = () => () => {};

export default function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);

  const { push, node: toastNode } = useToast();
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "https://your-domain.com");

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not load API keys");
      setKeys(data.keys ?? []);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const activeCount = keys.filter((k) => !k.revoked).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return keys.filter((k) => {
      if (statusFilter === "active" && k.revoked) return false;
      if (statusFilter === "revoked" && !k.revoked) return false;
      return !q || k.name.toLowerCase().includes(q) || k.key_prefix.toLowerCase().includes(q);
    });
  }, [keys, query, statusFilter]);

  const openCreate = () => {
    setName("");
    setNameError("");
    setNewKey(null);
    setSecretCopied(false);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setNewKey(null);
    setName("");
    setSecretCopied(false);
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Give the key a name so you can recognise it later");
      return;
    }
    if (trimmed.length > NAME_MAX) {
      setNameError(`Keep the name under ${NAME_MAX} characters`);
      return;
    }
    setCreating(true);
    setNameError("");
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!data.success) {
        setNameError(data.error || "Could not create the key");
        return;
      }
      setNewKey(data.apiKey.key);
      fetchKeys();
    } catch {
      setNameError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/api-keys/${revokeTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not revoke the key");
      push(`“${revokeTarget.name}” revoked`);
      fetchKeys();
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not revoke the key", "error");
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  };

  const handleCopySecret = async () => {
    if (!newKey) return;
    const ok = await copyText(newKey);
    if (ok) {
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2500);
    } else {
      push("Couldn’t copy automatically — select the key and copy it manually", "error");
    }
  };

  const snippet = `curl -X POST ${origin}/api/public/calls \\
  -H "Authorization: Bearer nova_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone_number": "9876543210",
    "agent_id": "<agent id>",
    "variable_values": { "name": "Asha" }
  }'`;

  const handleCopySnippet = async () => {
    const ok = await copyText(snippet);
    if (ok) {
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 2000);
    } else {
      push("Couldn’t copy the snippet", "error");
    }
  };

  return (
    <div className="ai2 ai2-page">
      <section className="ai2-panel">
        <div className="ai2-panel-head">
          <div className="ai2-panel-title">
            <span className="ai2-panel-icon"><KeyRound /></span>
            <div>
              <h2>API keys</h2>
              <p>Trigger calls from n8n, Make, Zapier or your own code. {activeCount} active key{activeCount === 1 ? "" : "s"}.</p>
            </div>
          </div>
          <button type="button" className="ai2-btn ai2-btn-primary" onClick={openCreate}>
            <Plus /> Create API key
          </button>
        </div>

        {keys.length > 0 && (
          <div className="ai2-toolbar">
            <label className="ai2-search">
              <Search aria-hidden="true" />
              <input type="search" placeholder="Search by name or key prefix" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search API keys" />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
            </select>
            <span className="ai2-count">{visible.length} of {keys.length}</span>
          </div>
        )}

        {loading ? (
          <div className="ai2-panel-body ai2-stack" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="ai2-skeleton ai2-skeleton-row" />)}
          </div>
        ) : loadError ? (
          <div className="ai2-empty">
            <span className="ai2-empty-icon ai2-empty-icon-warn"><TriangleAlert /></span>
            <h3>Couldn’t load API keys</h3>
            <p>{loadError}</p>
            <button type="button" className="ai2-btn" onClick={() => { setLoading(true); fetchKeys(); }}><RefreshCw /> Retry</button>
          </div>
        ) : keys.length === 0 ? (
          <div className="ai2-empty">
            <span className="ai2-empty-icon"><KeyRound /></span>
            <h3>No API keys yet</h3>
            <p>Create a key to start calls from automation tools or your own backend.</p>
            <button type="button" className="ai2-btn ai2-btn-primary" onClick={openCreate}><Plus /> Create API key</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="ai2-empty ai2-empty-compact">
            <h3>No keys match your filters</h3>
            <button type="button" className="ai2-btn" onClick={() => { setQuery(""); setStatusFilter("all"); }}>Clear filters</button>
          </div>
        ) : (
          <div className="ai2-table-wrap">
            <table className="ai2-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Key</th>
                  <th scope="col">Created</th>
                  <th scope="col">Last used</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="ai2-th-right"><span className="ai2-sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((k) => (
                  <tr key={k.id} className={k.revoked ? "is-muted" : ""}>
                    <td><span className="ai2-cell-strong">{k.name}</span></td>
                    <td><code className="ai2-code-inline">{k.key_prefix}••••••••</code></td>
                    <td title={fmtDateTime(k.created_at)}>{fmtDate(k.created_at)}</td>
                    <td title={k.last_used_at ? fmtDateTime(k.last_used_at) : undefined}>{k.last_used_at ? relTime(k.last_used_at) : "Never"}</td>
                    <td>{k.revoked ? <Pill tone="gray" dot>Revoked</Pill> : <Pill tone="green" dot>Active</Pill>}</td>
                    <td className="ai2-td-right">
                      {!k.revoked && (
                        <button type="button" className="ai2-btn ai2-btn-sm ai2-btn-ghost-danger" onClick={() => setRevokeTarget(k)} aria-label={`Revoke key ${k.name}`}>
                          <Trash2 /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ai2-panel">
        <div className="ai2-panel-head">
          <div className="ai2-panel-title">
            <span className="ai2-panel-icon"><Terminal /></span>
            <div>
              <h2>Trigger-call API</h2>
              <p>Start an outbound call with a single authenticated request.</p>
            </div>
          </div>
          <button type="button" className="ai2-btn" onClick={handleCopySnippet}>
            {snippetCopied ? <Check /> : <Copy />} {snippetCopied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="ai2-panel-body">
          <pre className="ai2-code" tabIndex={0} aria-label="curl example"><code>{snippet}</code></pre>
          <p className="ai2-hint">
            Replace <code>nova_YOUR_API_KEY</code> with a key from above and <code>&lt;agent id&gt;</code> with one of your agent IDs.
            10-digit numbers are treated as Indian (+91); otherwise include the country code. <code>variable_values</code> fills the agent’s <code>{"{{variables}}"}</code>.
          </p>
        </div>
      </section>

      {createOpen && (
        <Modal
          size="sm"
          title={newKey ? "Save your API key" : "Create API key"}
          subtitle={newKey ? undefined : "Name it after the tool or workflow that will use it."}
          icon={<KeyRound />}
          onClose={closeCreate}
          dismissOnBackdrop={!newKey}
          footer={
            newKey ? (
              <button type="button" className="ai2-btn ai2-btn-primary" onClick={closeCreate} data-autofocus>
                I’ve saved this key
              </button>
            ) : (
              <>
                <button type="button" className="ai2-btn" onClick={closeCreate}>Cancel</button>
                <button type="button" className="ai2-btn ai2-btn-primary" onClick={handleCreate} disabled={creating}>
                  {creating && <span className="ai2-spin" aria-hidden="true" />}
                  {creating ? "Creating…" : "Create key"}
                </button>
              </>
            )
          }
        >
          {newKey ? (
            <div className="ai2-stack">
              <div className="ai2-alert ai2-alert-warn" role="alert">
                <ShieldAlert />
                <span>This is the only time the full key is shown. Store it somewhere safe — if you lose it you’ll need to create a new one.</span>
              </div>
              <div className="ai2-secret">
                <code>{newKey}</code>
                <button type="button" className="ai2-btn ai2-btn-sm" onClick={handleCopySecret}>
                  {secretCopied ? <Check /> : <Copy />} {secretCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="ai2-hint">Send it as <code>Authorization: Bearer &lt;key&gt;</code>. Never expose it in client-side code.</p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="ai2-field">
              <label htmlFor="api-key-name">Key name</label>
              <input
                id="api-key-name"
                type="text"
                placeholder="e.g. n8n lead follow-up"
                value={name}
                maxLength={NAME_MAX + 20}
                onChange={(e) => { setName(e.target.value); setNameError(""); }}
                className={nameError ? "is-invalid" : ""}
                aria-invalid={!!nameError}
                data-autofocus
              />
              {nameError && <p className="ai2-error">{nameError}</p>}
            </form>
          )}
        </Modal>
      )}

      {revokeTarget && (
        <ConfirmDialog
          title={`Revoke “${revokeTarget.name}”?`}
          message="Any integration using this key will immediately start receiving 401 errors. This can’t be undone."
          confirmLabel="Revoke key"
          busy={revoking}
          onCancel={() => setRevokeTarget(null)}
          onConfirm={handleRevoke}
        />
      )}

      {toastNode}
    </div>
  );
}
