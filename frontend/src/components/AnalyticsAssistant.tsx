"use client";

import { FormEvent, useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";

type Message = { role: "assistant" | "user"; text: string };

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
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json();
      setMessages((current) => [...current, { role: "assistant", text: data.answer ?? "I could not retrieve your call analytics." }]);
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
          <div className="analytics-assistant-content">
            {messages.length === 0 && <><p>Ask about your calls, contacts, durations, and outcomes.</p><div className="analytics-assistant-suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => ask(suggestion)}>{suggestion}</button>)}</div></>}
            {messages.map((message, index) => <p key={`${message.role}-${index}`} className={`analytics-assistant-message ${message.role}`}>{message.text}</p>)}
            {loading && <p className="analytics-assistant-message assistant">Checking your call data...</p>}
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