"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  Link as LinkIcon,
  FileText,
  Trash2,
  BookOpen,
  Globe,
  FileType,
  CloudUpload,
  RefreshCw,
  X,
  TriangleAlert,
} from "lucide-react";
import { Modal, ConfirmDialog, Pill, useToast, fmtBytes, fmtDate } from "@/components/ai2-ui";

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

const ACCEPTED_EXTENSIONS = ["pdf", "docx", "txt"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const TYPE_LABEL: Record<KnowledgeDocument["source_type"], string> = {
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
  url: "Web page",
  text: "Pasted text",
};

const extensionOf = (name: string) => name.toLowerCase().split(".").pop() ?? "";

function DocIcon({ type }: { type: KnowledgeDocument["source_type"] }) {
  if (type === "url") return <Globe />;
  if (type === "pdf" || type === "docx") return <FileType />;
  return <FileText />;
}

export default function KnowledgeBaseManager({ agentId, agentName, onClose }: KnowledgeBaseManagerProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<AddMode>("file");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { push, node: toastNode } = useToast();

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not load documents");
      setDocuments(data.documents ?? []);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load documents");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const resetAddForm = () => {
    setTitle("");
    setUrl("");
    setText("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const acceptFile = (picked: File | undefined | null) => {
    if (!picked) return;
    const ext = extensionOf(picked.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError("Unsupported file type. Upload a PDF, DOCX or TXT file.");
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setError(`That file is ${fmtBytes(picked.size)}. The limit is ${fmtBytes(MAX_FILE_BYTES)} per file.`);
      return;
    }
    if (picked.size === 0) {
      setError("That file is empty.");
      return;
    }
    setError("");
    setFile(picked);
  };

  const uploadFile = (selected: File) =>
    new Promise<{ success: boolean; error?: string }>((resolve, reject) => {
      const form = new FormData();
      form.append("file", selected);
      if (title.trim()) form.append("title", title.trim());
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/agents/${agentId}/knowledge`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Unexpected response from the server"));
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(form);
    });

  const handleUpload = async () => {
    setError("");
    let valid = true;
    if (mode === "file" && !file) {
      setError("Choose or drop a file first");
      valid = false;
    } else if (mode === "url") {
      try {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
      } catch {
        setError("Enter a full web address starting with https://");
        valid = false;
      }
    } else if (mode === "text" && !text.trim()) {
      setError("Paste some text first");
      valid = false;
    }
    if (!valid) return;

    setUploading(true);
    setProgress(mode === "file" ? 0 : null);
    try {
      let data: { success: boolean; error?: string };
      if (mode === "file" && file) {
        data = await uploadFile(file);
      } else {
        const body = mode === "url"
          ? { url: url.trim(), title: title.trim() || undefined }
          : { text: text.trim(), title: title.trim() || undefined };
        const res = await fetch(`/api/agents/${agentId}/knowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        data = await res.json();
      }
      if (!data.success) {
        setError(data.error || "Failed to add document");
        return;
      }
      resetAddForm();
      push("Document added to the knowledge base");
      fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({ success: res.ok }));
      if (!data.success) throw new Error(data.error || "Could not delete document");
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      push(`Removed “${deleteTarget.title}”`);
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not delete document", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const processing = uploading && (mode !== "file" || progress === 100);
  const totalChunks = documents.reduce((s, d) => s + d.chunk_count, 0);

  return (
    <div className="ai2 ai2-contents">
      <Modal
        size="md"
        title="Knowledge base"
        subtitle={agentName}
        icon={<BookOpen />}
        onClose={uploading ? () => {} : onClose}
      >
        <p className="ai2-hint ai2-mb">
          Documents here are searched during calls so the agent can answer questions accurately. Content is split into
          searchable chunks and embedded when you add it.
        </p>

        <div className="ai2-kb-tabs" role="tablist" aria-label="Add content from">
          {([
            { id: "file", label: "Upload file", icon: Upload },
            { id: "url", label: "Web page", icon: LinkIcon },
            { id: "text", label: "Paste text", icon: FileText },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mode === t.id}
              className={mode === t.id ? "is-on" : ""}
              disabled={uploading}
              onClick={() => { setMode(t.id); setError(""); }}
            >
              <t.icon /> {t.label}
            </button>
          ))}
        </div>

        <div className="ai2-kb-form" role="tabpanel">
          {mode === "file" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.docx"
                hidden
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />
              <div
                className={`ai2-dropzone${dragging ? " is-drag" : ""}${file ? " has-file" : ""}`}
                onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (!uploading) acceptFile(e.dataTransfer.files?.[0]);
                }}
                onClick={() => !uploading && fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !uploading) {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload a file: drag and drop here or press Enter to browse"
              >
                {file ? (
                  <div className="ai2-dropzone-file">
                    <span className="ai2-doc-icon"><FileType /></span>
                    <div>
                      <strong>{file.name}</strong>
                      <span>{fmtBytes(file.size)} · {extensionOf(file.name).toUpperCase()}</span>
                    </div>
                    {!uploading && (
                      <button
                        type="button"
                        className="ai2-icon-btn"
                        aria-label="Remove selected file"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        <X />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <CloudUpload />
                    <strong>Drag &amp; drop a file here, or <u>browse</u></strong>
                    <span>PDF, DOCX or TXT · up to {fmtBytes(MAX_FILE_BYTES)} per file</span>
                  </>
                )}
              </div>
              <p className="ai2-hint">Scanned PDFs without selectable text can’t be read. Very long documents are limited to their first 300 chunks.</p>
            </>
          )}

          {mode === "url" && (
            <div className="ai2-field">
              <label htmlFor="kb-url">Page address</label>
              <input id="kb-url" type="url" placeholder="https://example.com/faq" value={url} onChange={(e) => setUrl(e.target.value)} disabled={uploading} />
              <p className="ai2-hint">We read the visible text of the page once; later changes to the page aren’t synced.</p>
            </div>
          )}

          {mode === "text" && (
            <div className="ai2-field">
              <label htmlFor="kb-text">Reference text</label>
              <textarea id="kb-text" rows={6} placeholder="Paste FAQs, pricing, policies…" value={text} onChange={(e) => setText(e.target.value)} disabled={uploading} />
              <div className="ai2-counter-row"><span /><span className="ai2-counter">{text.length.toLocaleString("en-IN")} characters</span></div>
            </div>
          )}

          <div className="ai2-field">
            <label htmlFor="kb-title">Title <span className="ai2-optional">(optional)</span></label>
            <input id="kb-title" type="text" placeholder="Defaults to the file name, address or “Pasted text”" value={title} onChange={(e) => setTitle(e.target.value)} disabled={uploading} />
          </div>

          {uploading && (
            <div className="ai2-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={processing ? undefined : progress ?? undefined} aria-label="Upload progress">
              <div className="ai2-progress-bar">
                <i className={processing || progress === null ? "is-indeterminate" : ""} style={processing || progress === null ? undefined : { width: `${progress}%` }} />
              </div>
              <span>{processing || progress === null ? "Reading and indexing content…" : `Uploading… ${progress}%`}</span>
            </div>
          )}

          {error && (
            <p className="ai2-alert" role="alert"><TriangleAlert /> {error}</p>
          )}

          <button type="button" className="ai2-btn ai2-btn-primary ai2-btn-block" onClick={handleUpload} disabled={uploading}>
            {uploading && <span className="ai2-spin" aria-hidden="true" />}
            {uploading ? "Processing…" : "Add to knowledge base"}
          </button>
        </div>

        <div className="ai2-kb-list-head">
          <h3>Documents</h3>
          {documents.length > 0 && <span className="ai2-muted">{documents.length} · {totalChunks.toLocaleString("en-IN")} chunks</span>}
        </div>

        {loading ? (
          <div className="ai2-stack" aria-busy="true">
            {[0, 1].map((i) => <div key={i} className="ai2-skeleton ai2-skeleton-row" />)}
          </div>
        ) : loadError ? (
          <div className="ai2-alert" role="alert">
            <TriangleAlert /> <span>{loadError}</span>
            <button type="button" className="ai2-link" onClick={() => { setLoading(true); fetchDocuments(); }}><RefreshCw /> Retry</button>
          </div>
        ) : documents.length === 0 ? (
          <div className="ai2-empty ai2-empty-compact">
            <span className="ai2-empty-icon"><BookOpen /></span>
            <h3>No documents yet</h3>
            <p>Add a file, web page or text above to give this agent reference material.</p>
          </div>
        ) : (
          <ul className="ai2-doc-list">
            {documents.map((doc) => (
              <li key={doc.id}>
                <span className="ai2-doc-icon"><DocIcon type={doc.source_type} /></span>
                <div className="ai2-doc-main">
                  <strong title={doc.title}>{doc.title}</strong>
                  <span>
                    {TYPE_LABEL[doc.source_type]} · {doc.chunk_count.toLocaleString("en-IN")} chunk{doc.chunk_count === 1 ? "" : "s"} · Added {fmtDate(doc.created_at)}
                  </span>
                </div>
                <Pill tone="green" dot>Ready</Pill>
                <button type="button" className="ai2-icon-btn ai2-icon-btn-danger" aria-label={`Delete ${doc.title}`} title="Delete" onClick={() => setDeleteTarget(doc)}>
                  <Trash2 />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this document?"
          message={<>“{deleteTarget.title}” will be removed and the agent will no longer use it to answer questions.</>}
          confirmLabel="Delete document"
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
      {toastNode}
    </div>
  );
}
