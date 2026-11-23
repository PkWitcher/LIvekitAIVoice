"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, History, MessageCircle, Plus, Send, Sparkles, X } from "lucide-react";

type Message = { role: "assistant" | "user"; text: string };
type ChatThread = { id: string; title: string; updated_at: string };

const suggestions = [
  "How many calls have I made?",
  "Which number did I call most?",
  "What was my longest call?",
  "What is my pickup rate?",
];

export default function AnalyticsAssistant() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const loadThreads = async () => {
    const response = await fetch("/api/analytics-assistant");
    const data = await response.json();
    if (data.success) setThreads(data.threads ?? []);
  };

  useEffect(() => {
    if (open) loadThreads().catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showHistory) setShowHistory(false);
      else {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, showHistory]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const startNewChat = () => {
    setThreadId(null);
    setMessages([]);
    setQuestion("");
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const openThread = async (id: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics-assistant?threadId=${encodeURIComponent(id)}`);
      const data = await response.json();
      if (data.success) {
        setThreadId(id);
        setMessages(data.messages ?? []);
        setShowHistory(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const ask = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);
    try {
      const response = await fetch("/api/analytics-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history: messages, threadId }),
      });
      const data = await response.json();
      setMessages((current) => [...current, { role: "assistant", text: data.answer ?? "I could not retrieve your call analytics." }]);
      if (data.threadId) setThreadId(data.threadId);
      loadThreads().catch(() => {});
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "I could not retrieve your call analytics right now." }]);
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    ask(question);
  };

  return (
    <div className="dh2-ai">
      {open && (
        <section className="dh2-ai-panel" aria-label="Call analytics assistant">
          <header className="dh2-ai-header">
            <div className="dh2-ai-title">
              <span className="dh2-ai-avatar"><Bot size={16} aria-hidden="true" /></span>
              <div>
                <strong>Call Insights</strong>
                <span>Answers from your call data only</span>
              </div>
            </div>
            <div className="dh2-ai-header-actions">
              <button onClick={startNewChat} title="New chat" aria-label="Start a new chat"><Plus size={16} /></button>
              <button
                onClick={() => setShowHistory((current) => !current)}
                title="Recent chats"
                aria-label="Recent chats"
                aria-expanded={showHistory}
                className={showHistory ? "active" : ""}
              >
                <History size={16} />
              </button>
              <button onClick={() => { setOpen(false); fabRef.current?.focus(); }} title="Close assistant" aria-label="Close assistant"><X size={16} /></button>
            </div>
          </header>

          <div className="dh2-ai-body">
            <div className="dh2-ai-log" ref={logRef} role="log" aria-live="polite" aria-label="Conversation">
              {messages.length === 0 && (
                <div className="dh2-ai-welcome">
                  <span className="dh2-ai-welcome-ico"><Sparkles size={18} aria-hidden="true" /></span>
                  <p>Ask about your calls, contacts, durations, and outcomes.</p>
                  <div className="dh2-ai-suggestions">
                    {suggestions.map((suggestion) => (
                      <button key={suggestion} onClick={() => ask(suggestion)} disabled={loading}>{suggestion}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((message, index) => (
                <p key={`${message.role}-${index}`} className={`dh2-ai-msg ${message.role}`}>{message.text}</p>
              ))}
              {loading && (
                <p className="dh2-ai-msg assistant dh2-ai-typing" aria-label="Checking your call data">
                  <span /><span /><span />
                </p>
              )}
            </div>

            {showHistory && (
              <aside className="dh2-ai-history" aria-label="Recent chats">
                <div className="dh2-ai-history-title"><History size={13} aria-hidden="true" /> Recent chats</div>
                {threads.length === 0 ? (
                  <p>No saved chats yet</p>
                ) : (
                  threads.map((thread) => (
                    <button key={thread.id} className={thread.id === threadId ? "active" : ""} onClick={() => openThread(thread.id)} title={thread.title}>
                      {thread.title}
                    </button>
                  ))
                )}
              </aside>
            )}
          </div>

          <form onSubmit={submit} className="dh2-ai-form">
            <input
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about your calls"
              aria-label="Ask a call analytics question"
            />
            <button type="submit" disabled={!question.trim() || loading} title="Send question" aria-label="Send question"><Send size={15} /></button>
          </form>
        </section>
      )}
      <button
        ref={fabRef}
        className="dh2-ai-fab"
        onClick={() => setOpen((current) => !current)}
        title={open ? "Close call insights" : "Open call insights"}
        aria-label={open ? "Close call insights" : "Open call insights"}
        aria-expanded={open}
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </div>
  );
}
