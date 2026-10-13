"use client";

import { useState, useEffect, useCallback } from "react";
import { KeyRound, Plus, Trash2, Copy, Check } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked: boolean;
  created_at: string;
}

export default function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/api-keys");
      const data = await res.json();
      if (data.success) setKeys(data.keys ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewKey(data.apiKey.key);
        setName("");
        fetchKeys();
      }
    } catch {
      /* silent */
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    fetchKeys();
  };

  const handleCopy = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-purple-400" />
        <h2 className="text-base font-semibold text-white">API Keys</h2>
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)] -mt-2">
        Use an API key to trigger calls programmatically from n8n, Make, Zapier, or your own code — see the Trigger-Call API section below.
      </p>

      {newKey && (
        <div className="px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
          <p className="text-[11px] text-amber-400 font-medium">Copy this key now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-white break-all">{newKey}</code>
            <button onClick={handleCopy} className="p-1.5 rounded text-amber-400 hover:text-amber-300 shrink-0" title="Copy">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Key name, e.g. n8n integration"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" /> Generate
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="dash-empty-state">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04]">
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{k.name}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] font-mono">
                  {k.key_prefix}… {k.revoked ? "· revoked" : k.last_used_at ? `· last used ${new Date(k.last_used_at).toLocaleDateString("en-IN")}` : "· never used"}
                </p>
              </div>
              {!k.revoked && (
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 transition-colors shrink-0"
                  title="Revoke"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-3 border-t border-[var(--color-border)]">
        <p className="text-[11px] text-[var(--color-text-muted)] mb-1.5">Trigger-Call API</p>
        <pre className="text-[10px] text-[var(--color-text-secondary)] bg-black/30 rounded-lg p-3 overflow-x-auto">
{`curl -X POST https://your-domain.com/api/public/calls \\
  -H "Authorization: Bearer nova_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"phone_number": "9876543210", "agent_id": "<agent id>"}'`}
        </pre>
      </div>
    </div>
  );
}
