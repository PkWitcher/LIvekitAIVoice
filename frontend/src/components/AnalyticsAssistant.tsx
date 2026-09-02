"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bot, History, MessageCircle, Plus, Send, X } from "lucide-react";

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

  const loadThreads = async () => {
    const response = await fetch("/api/analytics-assistant");
    const data = await response.json();
    if (data.success) setThreads(data.threads ?? []);
  };

  useEffect(() => {
    if (open) loadThreads().catch(() => {});
  }, [open]);

  const startNewChat = () => {
    setThreadId(null);
    setMessages([]);
    setQuestion("");
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
    <div className="analytics-assistant">
      {open && (
        <section className="analytics-assistant-panel" aria-label="Call analytics assistant">
          <header className="analytics-assistant-header">
            <div><Bot size={18} /><div><strong>Call Insights</strong><span>Project analytics only</span></div></div>
            <button onClick={() => setOpen(false)} title="Close assistant" aria-label="Close assistant"><X size={18} /></button>
          </header>
          <div className="analytics-assistant-body">
            <aside className="analytics-assistant-history">
              <button className="analytics-assistant-new" onClick={startNewChat}><Plus size={14} /> New chat</button>
              <div className="analytics-assistant-history-title"><History size={13} /> Recent chats</div>
              {threads.length === 0 ? <p>No saved chats</p> : threads.map((thread) => <button key={thread.id} className={thread.id === threadId ? "active" : ""} onClick={() => openThread(thread.id)} title={thread.title}>{thread.title}</button>)}
            </aside>
            <div className="analytics-assistant-content">
              {messages.length === 0 && <><p>Ask about your calls, contacts, durations, and outcomes.</p><div className="analytics-assistant-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => ask(suggestion)}>{suggestion}</button>)}</div></>}
              {messages.map((message, index) => <p key={`${message.role}-${index}`} className={`analytics-assistant-message ${message.role}`}>{message.text}</p>)}
              {loading && <p className="analytics-assistant-message assistant">Checking your call data...</p>}
            </div>
          </div>
          <form onSubmit={submit} className="analytics-assistant-form">
            <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your calls" aria-label="Ask a call analytics question" />
            <button type="submit" disabled={!question.trim() || loading} title="Send question" aria-label="Send question"><Send size={16} /></button>
          </form>
        </section>
      )}
      <button className="analytics-assistant-fab" onClick={() => setOpen((current) => !current)} title="Open call insights" aria-label="Open call insights">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}