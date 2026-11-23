import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Building2,
  Car,
  Check,
  ChevronDown,
  ChartColumn,
  ClipboardList,
  FileText,
  GraduationCap,
  Headphones,
  Landmark,
  ListChecks,
  Mic,
  Phone,
  PhoneCall,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Upload,
  Webhook,
} from "lucide-react";
import LandingNavbar from "@/components/LandingNavbar";
import "@/styles/public-pages.css";

const WAVE = [28, 52, 74, 40, 88, 62, 34, 78, 96, 58, 30, 70, 84, 46, 24, 66, 92, 54, 36, 80, 68, 42, 26, 72, 90, 50, 32, 64, 76, 38];

const CAPABILITIES = [
  { icon: PhoneCall, title: "Outbound & inbound", desc: "Single dispatch or whole campaigns" },
  { icon: Upload, title: "Bulk dialer", desc: "Upload CSV / XLSX contact lists" },
  { icon: FileText, title: "Transcripts & recordings", desc: "Stored for every answered call" },
  { icon: Webhook, title: "API & webhooks", desc: "Hashed API keys, signed events" },
];

const FEATURES = [
  { icon: Bot, title: "Voice agents you configure", desc: "Write the system prompt and opening line, choose a voice, and reuse {{variables}} to personalise each call." },
  { icon: BookOpen, title: "Knowledge base", desc: "Attach your own documents so the agent answers from your content instead of guessing." },
  { icon: Upload, title: "Bulk campaigns", desc: "Paste numbers or upload a CSV/XLSX contact list and dial the whole batch from one screen." },
  { icon: Mic, title: "Live transcripts & recordings", desc: "Follow conversations as they happen, then replay the recording and read the transcript afterwards." },
  { icon: ListChecks, title: "Automatic call outcomes", desc: "Each call is classified (Interested, Booked, Callback Requested, Voicemail…) with a one-line summary." },
  { icon: ChartColumn, title: "Analytics", desc: "Track pickup rate, minutes used, inbound vs outbound volume and conversion rate over time." },
  { icon: Webhook, title: "API keys & webhooks", desc: "Trigger calls from your own systems and receive HMAC-signed webhook events for call activity." },
  { icon: ClipboardList, title: "Google Sheets write-back", desc: "Send outcomes, summaries and appointment dates back into your Google Sheet after each call." },
];

const STEPS = [
  { title: "Create an agent", desc: "Define the script, voice and optional knowledge base for the conversation." },
  { title: "Add your contacts", desc: "Dial a single number, paste a list, or upload a CSV/XLSX file." },
  { title: "Launch the calls", desc: "Start the campaign and watch call status and live transcripts update." },
  { title: "Review & automate", desc: "Read outcomes and analytics, then push results to your tools via webhooks." },
];

const USE_CASES = [
  { icon: Stethoscope, title: "Healthcare", desc: "Appointment reminders, prescription refill alerts and patient follow-up calls." },
  { icon: ShoppingCart, title: "E-commerce", desc: "Order confirmations, delivery updates and customer feedback collection." },
  { icon: Landmark, title: "Finance", desc: "Payment reminders, account follow-ups and loan outreach." },
  { icon: Building2, title: "Real estate", desc: "Site-visit reminders, lead qualification and tenant rent reminders." },
  { icon: GraduationCap, title: "Education", desc: "Enrollment follow-ups, fee reminders and attendance alerts to parents." },
  { icon: Car, title: "Automotive", desc: "Service reminders, insurance renewals and test-drive confirmations." },
];

const PLANS = [
  { name: "Free", price: "₹0", calls: "50", minutes: "100", features: ["Single call dispatch", "Call history", "Basic analytics"], featured: false },
  { name: "Basic", price: "₹999", calls: "200", minutes: "500", features: ["Bulk campaigns", "Call recording", "Priority support"], featured: false },
  { name: "Pro", price: "₹2,999", calls: "1,000", minutes: "2,000", features: ["Custom voice & scripts", "API access", "Advanced analytics"], featured: true },
  { name: "Enterprise", price: "₹9,999", calls: "10,000", minutes: "20,000", features: ["Dedicated infrastructure", "Custom integrations", "24/7 support"], featured: false },
];

const FAQS = [
  { q: "How natural does the AI voice sound?", a: "Agents speak using Deepgram text-to-speech and understand callers with real-time speech-to-text. You can pick from several male and female voices when you configure an agent." },
  { q: "Can the agent hold a two-way conversation?", a: "Yes. The agent listens, replies based on your prompt and knowledge base, and can answer questions and handle objections. You can follow the conversation live and read the transcript afterwards." },
  { q: "Which phone numbers are supported?", a: "Indian (+91) numbers are supported today. Support for other regions is on the roadmap." },
  { q: "How is my data protected?", a: "Access is protected by account authentication. API keys are stored only as SHA-256 hashes, and webhook payloads are signed with HMAC so you can verify they came from Nova AI." },
  { q: "How do I get started?", a: "Create an account, confirm your email, and sign in to the dashboard. Build an agent, add a number or upload a list, and place your first call." },
  { q: "What happens when I reach my plan limit?", a: "You'll see the limit in your dashboard. You can upgrade your plan to continue, or wait for your monthly allowance to reset." },
];

const FOOTER_PRODUCT = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingPage() {
  return (
    <div className="pp2 pp2-landing">
      <a href="#main" className="pp2-skip">Skip to main content</a>
      <div className="pp2-bg" aria-hidden="true" />
      <LandingNavbar />

      <main id="main">
        {/* Hero */}
        <section className="pp2-hero" aria-labelledby="hero-title">
          <div className="pp2-wrap pp2-hero-grid">
            <div>
              <span className="pp2-badge">
                <span className="pp2-badge-dot" aria-hidden="true" />
                AI voice agents for phone calls
              </span>
              <h1 id="hero-title" className="pp2-h1">
                Voice agents that run your <span className="pp2-grad-text">phone calls at scale</span>
              </h1>
              <p className="pp2-hero-sub">
                Configure an AI agent with your script and knowledge base, then place outbound campaigns or track inbound
                calls. Every call is transcribed, recorded and classified automatically.
              </p>
              <div className="pp2-hero-cta">
                <Link href="/login?mode=signup" className="pp2-btn pp2-btn-primary pp2-btn-lg">
                  Start free <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <a href="#how-it-works" className="pp2-btn pp2-btn-secondary pp2-btn-lg">
                  See how it works
                </a>
              </div>
              <p className="pp2-hero-note">The Free plan includes 50 calls and 100 minutes per month.</p>
            </div>

            <div className="pp2-visual">
              <div className="pp2-window" aria-hidden="true">
                <div className="pp2-window-bar">
                  <span className="pp2-dots"><i /><i /><i /></span>
                  <span className="pp2-window-title">Call console</span>
                  <span className="pp2-live">Live</span>
                </div>
                <div className="pp2-call-head">
                  <span className="pp2-avatar"><Bot size={20} /></span>
                  <div>
                    <div className="pp2-call-name">Appointment reminder agent</div>
                    <div className="pp2-call-meta">Outbound · +91 98•••• ••210</div>
                  </div>
                  <span className="pp2-timer">02:14</span>
                </div>
                <div className="pp2-wave">
                  {WAVE.map((h, i) => (
                    <i key={i} style={{ "--h": h, "--i": i } as CSSProperties} />
                  ))}
                </div>
                <div className="pp2-chat">
                  <div className="pp2-bubble pp2-bubble-ai">
                    <small>Agent</small>
                    Hi Priya, this is a reminder about your appointment tomorrow at 11 AM. Does that time still work?
                  </div>
                  <div className="pp2-bubble pp2-bubble-user">
                    <small>Caller</small>
                    Could we move it to the afternoon?
                  </div>
                </div>
                <div className="pp2-outcome">
                  <span className="pp2-chip pp2-chip-ok"><Check size={12} /> Callback Requested</span>
                  <span className="pp2-chip"><FileText size={12} /> Transcript saved</span>
                  <span className="pp2-chip"><Headphones size={12} /> Recording</span>
                </div>
              </div>
              <div className="pp2-float pp2-float-a" aria-hidden="true">
                <span className="pp2-float-icon"><Webhook size={16} /></span>
                <span><strong>Webhook delivered</strong>call.completed</span>
              </div>
              <div className="pp2-float pp2-float-b" aria-hidden="true">
                <span className="pp2-float-icon"><Sparkles size={16} /></span>
                <span><strong>AI summary ready</strong>Outcome classified</span>
              </div>
              <p className="pp2-visual-cap">Illustrative preview with sample conversation</p>
            </div>
          </div>
        </section>

        {/* Capability strip */}
        <section className="pp2-strip" aria-label="Platform capabilities">
          <div className="pp2-wrap">
            <ul className="pp2-strip-grid">
              {CAPABILITIES.map((c) => (
                <li key={c.title} className="pp2-strip-item">
                  <c.icon size={22} aria-hidden="true" />
                  <div>
                    <strong>{c.title}</strong>
                    <span>{c.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="pp2-section" aria-labelledby="features-title">
          <div className="pp2-wrap">
            <div className="pp2-section-head">
              <span className="pp2-eyebrow">Platform</span>
              <h2 id="features-title" className="pp2-h2">Everything you need to run AI calling</h2>
              <p className="pp2-lead">From building the agent to reviewing outcomes, one workspace covers the whole call lifecycle.</p>
            </div>
            <div className="pp2-grid-4">
              {FEATURES.map((f) => (
                <article key={f.title} className="pp2-card">
                  <span className="pp2-icon-box"><f.icon size={20} aria-hidden="true" /></span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="pp2-section pp2-section-alt" aria-labelledby="how-title">
          <div className="pp2-wrap">
            <div className="pp2-section-head">
              <span className="pp2-eyebrow">How it works</span>
              <h2 id="how-title" className="pp2-h2">From first agent to live calls in four steps</h2>
              <p className="pp2-lead">No telephony setup to manage — configure, upload and dial.</p>
            </div>
            <ol className="pp2-grid-4 pp2-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="pp2-step">
                  <span className="pp2-step-num" aria-hidden="true">{i + 1}</span>
                  <h3><span className="pp2-sr">Step {i + 1}: </span>{s.title}</h3>
                  <p>{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Use cases */}
        <section id="use-cases" className="pp2-section" aria-labelledby="usecases-title">
          <div className="pp2-wrap">
            <div className="pp2-section-head">
              <span className="pp2-eyebrow">Use cases</span>
              <h2 id="usecases-title" className="pp2-h2">Automate the calls your team repeats every day</h2>
              <p className="pp2-lead">Reminders, follow-ups and confirmations across industries.</p>
            </div>
            <div className="pp2-grid-3">
              {USE_CASES.map((u) => (
                <article key={u.title} className="pp2-card">
                  <span className="pp2-icon-box"><u.icon size={20} aria-hidden="true" /></span>
                  <h3>{u.title}</h3>
                  <p>{u.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="pp2-section pp2-section-alt" aria-labelledby="pricing-title">
          <div className="pp2-wrap">
            <div className="pp2-section-head">
              <span className="pp2-eyebrow">Pricing</span>
              <h2 id="pricing-title" className="pp2-h2">Simple plans that grow with your call volume</h2>
              <p className="pp2-lead">Start free and upgrade when you need more calls and minutes.</p>
            </div>
            <div className="pp2-grid-4">
              {PLANS.map((p) => (
                <div key={p.name} className={`pp2-price-card${p.featured ? " is-featured" : ""}`}>
                  {p.featured && <span className="pp2-price-tag">Most popular</span>}
                  <h3 className="pp2-price-name">{p.name}</h3>
                  <div className="pp2-price-amount">
                    <strong>{p.price}</strong>
                    <span>/ month</span>
                  </div>
                  <div className="pp2-price-limits">
                    <span><b>{p.calls}</b> calls / month</span>
                    <span><b>{p.minutes}</b> minutes / month</span>
                  </div>
                  <ul className="pp2-price-list">
                    {p.features.map((f) => (
                      <li key={f}>
                        <Check size={15} aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login?mode=signup"
                    className={`pp2-btn pp2-btn-block ${p.featured ? "pp2-btn-primary" : "pp2-btn-secondary"}`}
                    aria-label={p.name === "Free" ? "Start free" : `Get started with ${p.name}`}
                  >
                    {p.name === "Free" ? "Start free" : "Get started"}
                  </Link>
                </div>
              ))}
            </div>
            <p className="pp2-price-note">Prices are in Indian rupees (₹) per month.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="pp2-section" aria-labelledby="faq-title">
          <div className="pp2-wrap">
            <div className="pp2-section-head">
              <span className="pp2-eyebrow">FAQ</span>
              <h2 id="faq-title" className="pp2-h2">Frequently asked questions</h2>
            </div>
            <div className="pp2-faq">
              {FAQS.map((f) => (
                <details key={f.q}>
                  <summary>
                    {f.q}
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <p className="pp2-faq-a">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="pp2-section" style={{ paddingTop: 0 }} aria-labelledby="cta-title">
          <div className="pp2-wrap">
            <div className="pp2-cta">
              <h2 id="cta-title" className="pp2-h2">Ready to put your calls on autopilot?</h2>
              <p className="pp2-lead">Create a free account and place your first AI-powered call from the dashboard.</p>
              <div className="pp2-hero-cta">
                <Link href="/login?mode=signup" className="pp2-btn pp2-btn-primary pp2-btn-lg">
                  Create free account <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link href="/login" className="pp2-btn pp2-btn-secondary pp2-btn-lg">
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="pp2-footer">
        <div className="pp2-wrap">
          <div className="pp2-footer-grid">
            <div>
              <Link href="/" className="pp2-brand" aria-label="Nova AI home">
                <span className="pp2-logo" aria-hidden="true"><Phone size={16} strokeWidth={2.25} /></span>
                Nova AI
              </Link>
              <p>AI voice agents for outbound and inbound phone calls, with transcripts, analytics and integrations.</p>
            </div>
            <nav aria-label="Product">
              <h4>Product</h4>
              <ul>
                {FOOTER_PRODUCT.map((l) => (
                  <li key={l.href}><a href={l.href}>{l.label}</a></li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Account">
              <h4>Account</h4>
              <ul>
                <li><Link href="/login">Log in</Link></li>
                <li><Link href="/login?mode=signup">Create account</Link></li>
                <li><Link href="/admin/login">Admin console</Link></li>
              </ul>
            </nav>
          </div>
          <div className="pp2-footer-bottom">
            <span>&copy; {new Date().getFullYear()} Nova AI. All rights reserved.</span>
            <span>Powered by LiveKit, Deepgram and OpenAI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
