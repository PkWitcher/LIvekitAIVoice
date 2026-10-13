"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Upload, Link as LinkIcon, FileText, Trash2, BookOpen } from "lucide-react";

interface KnowledgeDocument {
  id: string;
  title: string;
  source_type: "txt" | "pdf" | "docx" | "url" | "text";
  source_url: string | null;
  chunk_count: number;
  created_at: string;
}

interface KnowledgeBaseManagerProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
}

type AddMode = "file" | "url" | "text";

export default function KnowledgeBaseManager({ agentId, agentName, onClose }: KnowledgeBaseManagerProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AddMode>("file");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge`);
      const data = await res.json();
      if (data.success) setDocuments(data.documents ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const resetAddForm = () => {
    setTitle("");
    setUrl("");
    setText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    setError("");
    setUploading(true);
    try {
      let res: Response;
      if (mode === "file") {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          setError("Choose a file first");
          setUploading(false);
          return;
        }
        const form = new FormData();
        form.append("file", file);
        if (title.trim()) form.append("title", title.trim());
        res = await fetch(`/api/agents/${agentId}/knowledge`, { method: "POST", body: form });
      } else if (mode === "url") {
        if (!url.trim()) {
          setError("Enter a URL first");
          setUploading(false);
          return;
        }
        res = await fetch(`/api/agents/${agentId}/knowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), title: title.trim() || undefined }),
        });
      } else {
        if (!text.trim()) {
          setError("Paste some text first");
          setUploading(false);
          return;
        }
        res = await fetch(`/api/agents/${agentId}/knowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), title: title.trim() || undefined }),
        });
      }
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to add document");
        return;
      }
      resetAddForm();
      fetchDocuments();
    } catch {
      setError("Network error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    await fetch(`/api/agents/${agentId}/knowledge/${docId}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-xl space-y-5 my-8 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-[var(--color-text-muted)] hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-400" />
          <h2 className="text-base font-semibold text-white">Knowledge Base — {agentName}</h2>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] -mt-3">
          Upload documents this agent can reference to answer questions during a call.
        </p>

        {/* Existing documents */}
        {loading ? (
          <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">No documents yet.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04]">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{doc.title}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {doc.source_type.toUpperCase()} · {doc.chunk_count} chunks
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 transition-colors shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add document */}
        <div className="pt-3 border-t border-[var(--color-border)] space-y-3">
          <div className="flex gap-2">
            {([
              { id: "file", label: "File", icon: Upload },
              { id: "url", label: "URL", icon: LinkIcon },
              { id: "text", label: "Paste Text", icon: FileText },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => { setMode(t.id); setError(""); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 flex items-center gap-1.5 ${
                  mode === t.id
                    ? "bg-purple-600 text-white"
                    : "bg-white/[0.06] text-[var(--color-text-muted)] hover:bg-white/[0.1]"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {mode === "file" && (
            <input ref={fileInputRef} type="file" accept=".txt,.pdf,.docx" className="!p-2 !text-xs" />
          )}
          {mode === "url" && (
            <input
              type="url"
              placeholder="https://example.com/faq"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}
          {mode === "text" && (
            <textarea
              rows={5}
              placeholder="Paste reference text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-2.5 rounded-lg font-medium text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 flex items-center justify-center gap-2"
          >
            {uploading ? (<><span className="spinner" /> Processing…</>) : "Add to Knowledge Base"}
          </button>
        </div>
      </div>
    </div>
  );
}
