import Link from "next/link";
import LandingNavbar from "@/components/LandingNavbar";

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* ── Ambient Glow ── */}
      <div className="landing-glow">
        <div className="glow-orb glow-orb-top" />
        <div className="glow-orb glow-orb-bottom" />
        <div className="bg-ring bg-ring-1" />
        <div className="bg-ring bg-ring-2" />
        <div className="bg-ring bg-ring-3" />
      </div>

      {/* ── Floating Particles ── */}
      <div className="bg-particles">
        <div className="bg-particle" />
        <div className="bg-particle" />
        <div className="bg-particle" />
        <div className="bg-particle" />
        <div className="bg-particle" />
        <div className="bg-particle" />
        <div className="bg-particle" />
        <div className="bg-particle" />
      </div>

      {/* ── Nav ── */}
      <LandingNavbar />

      {/* ── Hero ── */}
      <section className="landing-section hero-section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-12 col-lg-10 col-xl-8 text-center">
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                <span>AI-Powered Voice Automation</span>
              </div>

              <h1 className="hero-title">
                Automate phone calls with{" "}
                <span className="hero-gradient">AI that speaks naturally</span>
              </h1>

              <p className="hero-subtitle">
                Deploy intelligent voice agents that make real phone calls — appointment reminders,
                customer outreach, follow-ups — all automated with human-like conversations.
              </p>

              <div className="d-flex flex-column flex-sm-row align-items-center justify-content-center gap-3 mt-5">
                <Link href="/login" className="btn-primary-glow">
                  Get Started
                </Link>
                <a href="#features" className="btn-outline-custom">
                  Learn More
                </a>
              </div>
            </div>
          </div>

          {/* Hero Stats */}
          <div className="row justify-content-center mt-5 pt-5">
            <div className="col-10 col-sm-8 col-md-6 col-lg-5">
              <div className="row text-center">
                <div className="col-4">
                  <div className="stat-value">500+</div>
                  <div className="stat-label">Calls Made</div>
                </div>
                <div className="col-4">
                  <div className="stat-value">{"<"}₹2</div>
                  <div className="stat-label">Per Minute</div>
                </div>
                <div className="col-4">
                  <div className="stat-value">98%</div>
                  <div className="stat-label">Uptime</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Dashboard Preview ── */}
          <div className="row justify-content-center mt-5 pt-4">
            <div className="col-12 col-lg-10">
              <div className="dashboard-preview">
                {/* Browser chrome */}
                <div className="preview-chrome">
                  <div className="preview-dots">
                    <span className="preview-dot dot-red" />
                    <span className="preview-dot dot-yellow" />
                    <span className="preview-dot dot-green" />
                  </div>
                  <div className="preview-url-bar">
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ opacity: 0.4 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                    <span>nova-ai.app/dashboard</span>
                  </div>
                </div>

                {/* Dashboard content */}
                <div className="preview-body">
                  {/* Sidebar */}
                  <div className="preview-sidebar">
                    <div className="preview-sidebar-brand">
                      <div className="preview-sidebar-logo" />
                      <div>
                        <div className="preview-sidebar-title">Nova AI</div>
                        <div className="preview-sidebar-sub">Voice Platform</div>
                      </div>
                    </div>
                    <div className="preview-sidebar-nav">
                      <div className="preview-nav-item active">
                        <div className="preview-nav-icon">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>
                        </div>
                        Dashboard
                      </div>
                      <div className="preview-nav-item">
                        <div className="preview-nav-icon">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
                        </div>
                        Calls
                      </div>
                      <div className="preview-nav-item">
                        <div className="preview-nav-icon">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
                        </div>
                        Transcripts
                      </div>
                      <div className="preview-nav-item">
                        <div className="preview-nav-icon">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                        </div>
                        Settings
                      </div>
                    </div>
                  </div>

                  {/* Main area */}
                  <div className="preview-main">
                    {/* Stats row */}
                    <div className="preview-stats-row">
                      <div className="preview-stat-card">
                        <div className="preview-stat-label">Total Calls</div>
                        <div className="preview-stat-value">1,247</div>
                        <div className="preview-stat-change up">↑ 12.5%</div>
                      </div>
                      <div className="preview-stat-card">
                        <div className="preview-stat-label">Completed</div>
                        <div className="preview-stat-value">1,089</div>
                        <div className="preview-stat-change up">↑ 8.3%</div>
                      </div>
                      <div className="preview-stat-card">
                        <div className="preview-stat-label">Pickup Rate</div>
                        <div className="preview-stat-value">87.3%</div>
                        <div className="preview-stat-change up">↑ 3.1%</div>
                      </div>
                      <div className="preview-stat-card">
                        <div className="preview-stat-label">Avg Duration</div>
                        <div className="preview-stat-value">2m 34s</div>
                        <div className="preview-stat-change down">↓ 0.5%</div>
                      </div>
                    </div>

                    {/* Chart area */}
                    <div className="preview-chart-area">
                      <div className="preview-chart-header">
                        <span className="preview-chart-title">Call Volume (Last 7 Days)</span>
                        <span className="preview-chart-legend">
                          <span className="legend-dot legend-blue" /> Completed
                          <span className="legend-dot legend-purple" /> Total
                        </span>
                      </div>
                      <div className="preview-chart">
                        <div className="chart-bars">
                          {[65, 45, 80, 55, 90, 70, 85].map((h, i) => (
                            <div key={i} className="chart-bar-group">
                              <div className="chart-bar bar-total" style={{ height: `${h}%` }} />
                              <div className="chart-bar bar-completed" style={{ height: `${h * 0.75}%` }} />
                              <span className="chart-bar-label">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Recent calls */}
                    <div className="preview-recent">
                      <div className="preview-chart-title" style={{ marginBottom: "10px" }}>Recent Calls</div>
                      {[
                        { phone: "+91 98765 43210", status: "Completed", dur: "3m 12s" },
                        { phone: "+91 87654 32109", status: "Completed", dur: "1m 45s" },
                        { phone: "+91 76543 21098", status: "No Answer", dur: "—" },
                      ].map((c, i) => (
                        <div key={i} className="preview-call-row">
                          <span className="preview-call-phone">{c.phone}</span>
                          <span className={`preview-call-status ${c.status === "Completed" ? "status-ok" : "status-na"}`}>{c.status}</span>
                          <span className="preview-call-dur">{c.dur}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="landing-section">
        <div className="container">
          <div className="row justify-content-center mb-5 pb-3">
            <div className="col-12 col-lg-7 text-center">
              <h2 className="section-title">Everything you need for AI calling</h2>
              <p className="section-subtitle">A complete voice automation platform built for scale and simplicity.</p>
            </div>
          </div>

          <div className="row g-4 justify-content-center">
            {[
              { icon: "🎙️", title: "Natural Voice AI", desc: "Human-like speech powered by Deepgram TTS with multiple voice options — male and female." },
              { icon: "📊", title: "Bulk Campaigns", desc: "Dial hundreds of numbers in one click with customizable scripts for each campaign." },
              { icon: "📡", title: "Live Call Tracking", desc: "Real-time status updates — ringing, connected, completed, no-answer — with 1s refresh." },
              { icon: "🔊", title: "Call Recording", desc: "Every answered call is recorded automatically. Play back recordings from the dashboard." },
              { icon: "💰", title: "Ultra Low Cost", desc: "Under ₹2 per minute using OpenAI + Deepgram (pay-per-use STT/TTS)." },
              { icon: "🔒", title: "Self-Hosted & Secure", desc: "100% self-hosted on your infrastructure. No data leaves your servers — full control." },
            ].map((f, i) => (
              <div key={i} className="col-12 col-md-6 col-lg-4">
                <div className="feature-card">
                  <div className="feature-icon">{f.icon}</div>
                  <h5 className="text-white fw-semibold mb-2">{f.title}</h5>
                  <p className="feature-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="landing-section">
        <div className="container">
          <div className="row justify-content-center mb-5 pb-3">
            <div className="col-12 col-lg-7 text-center">
              <h2 className="section-title">How it works</h2>
              <p className="section-subtitle">Three simple steps to automated calling.</p>
            </div>
          </div>

          <div className="row g-5 justify-content-center">
            {[
              { step: "01", title: "Enter Numbers", desc: "Add phone numbers individually or in bulk via the dashboard." },
              { step: "02", title: "Set Your Script", desc: "Write a prompt for what the AI should say and how it should respond." },
              { step: "03", title: "Launch & Monitor", desc: "Hit dial and watch real-time status updates with call recordings." },
            ].map((s, i) => (
              <div key={i} className="col-12 col-md-4 text-center">
                <div className="step-number">{s.step}</div>
                <h5 className="text-white fw-semibold mb-2">{s.title}</h5>
                <p className="feature-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section className="landing-section">
        <div className="container">
          <div className="row justify-content-center mb-5 pb-3">
            <div className="col-12 col-lg-7 text-center">
              <h2 className="section-title">Built for every industry</h2>
              <p className="section-subtitle">From healthcare to e-commerce — automate calls that matter.</p>
            </div>
          </div>

          <div className="row g-4 justify-content-center">
            {[
              { icon: "🏥", title: "Healthcare", desc: "Appointment reminders, prescription refill alerts, and patient follow-up calls — reduce no-shows by 60%." },
              { icon: "🛒", title: "E-Commerce", desc: "Order confirmations, delivery updates, abandoned cart recovery, and customer feedback collection." },
              { icon: "🏦", title: "Finance & Banking", desc: "Payment reminders, fraud alerts, account verification calls, and loan follow-ups." },
              { icon: "🏢", title: "Real Estate", desc: "Property viewing reminders, lead qualification calls, and tenant rent reminders." },
              { icon: "🎓", title: "Education", desc: "Enrollment follow-ups, fee payment reminders, attendance alerts to parents." },
              { icon: "🚗", title: "Automotive", desc: "Service reminders, insurance renewal calls, and test drive booking confirmations." },
            ].map((uc, i) => (
              <div key={i} className="col-12 col-md-6 col-lg-4">
                <div className="feature-card">
                  <div className="feature-icon">{uc.icon}</div>
                  <h5 className="text-white fw-semibold mb-2">{uc.title}</h5>
                  <p className="feature-desc">{uc.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="landing-section">
        <div className="container">
          <div className="row justify-content-center mb-5 pb-3">
            <div className="col-12 col-lg-7 text-center">
              <h2 className="section-title">Simple, transparent pricing</h2>
              <p className="section-subtitle">Start free. Scale as you grow. No hidden fees.</p>
            </div>
          </div>

          <div className="row g-4 justify-content-center">
            {[
              { plan: "Free", price: "₹0", period: "/month", calls: "50 calls", minutes: "100 minutes", features: ["Single call dispatch", "Call history", "Basic analytics"], highlight: false },
              { plan: "Basic", price: "₹999", period: "/month", calls: "200 calls", minutes: "500 minutes", features: ["Bulk campaigns", "Call recording", "Priority support"], highlight: false },
              { plan: "Pro", price: "₹2,999", period: "/month", calls: "1,000 calls", minutes: "2,000 minutes", features: ["Custom voice & scripts", "API access", "Advanced analytics"], highlight: true },
              { plan: "Enterprise", price: "₹9,999", period: "/month", calls: "10,000 calls", minutes: "20,000 minutes", features: ["Dedicated infrastructure", "Custom integrations", "24/7 support"], highlight: false },
            ].map((p, i) => (
              <div key={i} className="col-12 col-sm-6 col-lg-3">
                <div className={`pricing-card ${p.highlight ? "pricing-card-highlight" : ""}`}>
                  <div className="pricing-plan">{p.plan}</div>
                  <div className="pricing-price">
                    <span className="pricing-amount">{p.price}</span>
                    <span className="pricing-period">{p.period}</span>
                  </div>
                  <div className="pricing-limits">
                    <span>{p.calls}</span>
                    <span>{p.minutes}</span>
                  </div>
                  <ul className="pricing-features">
                    {p.features.map((f, fi) => (
                      <li key={fi}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className={p.highlight ? "btn-primary-glow pricing-btn" : "btn-outline-custom pricing-btn"}>
                    {p.plan === "Free" ? "Start Free" : "Get Started"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="landing-section">
        <div className="container">
          <div className="row justify-content-center mb-5 pb-3">
            <div className="col-12 col-lg-7 text-center">
              <h2 className="section-title">Frequently asked questions</h2>
              <p className="section-subtitle">Everything you need to know before getting started.</p>
            </div>
          </div>

          <div className="row justify-content-center">
            <div className="col-12 col-lg-8">
              <div className="faq-list">
                {[
                  { q: "How does the AI voice sound?", a: "We use Deepgram's latest TTS models that produce natural, human-like speech. You can choose between multiple voice options including male and female voices." },
                  { q: "Can the AI handle two-way conversations?", a: "Yes! The AI uses real-time speech-to-text and responds intelligently based on your prompt. It can handle objections, answer questions, and guide conversations." },
                  { q: "What phone numbers are supported?", a: "Currently we support Indian (+91) numbers. International calling is on our roadmap and will be available soon." },
                  { q: "Is my data secure?", a: "100%. The platform is fully self-hosted on your infrastructure. Call recordings, prompts, and user data never leave your servers." },
                  { q: "How quickly can I get started?", a: "Under 5 minutes. Sign up, get your subscription activated by admin, and you can start making AI calls immediately from the dashboard." },
                  { q: "What happens when the call limit is reached?", a: "You'll see a notification in your dashboard. Contact the admin to upgrade your plan or wait for the monthly reset." },
                ].map((faq, i) => (
                  <div key={i} className="faq-item">
                    <h5 className="faq-question">{faq.q}</h5>
                    <p className="faq-answer">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="landing-section-sm">
        <div className="container">
          <div className="tech-divider" />
          <p className="tech-label">Powered By</p>
          <div className="d-flex flex-wrap align-items-center justify-content-center gap-4 gap-sm-5">
            {["LiveKit", "Deepgram", "OpenAI", "Supabase", "Next.js", "Docker"].map((t) => (
              <span key={t} className="tech-name">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="landing-section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-12 col-lg-7 text-center">
              <h2 className="section-title">Ready to automate your calls?</h2>
              <p className="section-subtitle mb-5">Open the dashboard and make your first AI call in under a minute.</p>
              <Link href="/login" className="btn-primary-glow">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="container">
          <div className="tech-divider" />
          <div className="d-flex flex-column flex-sm-row align-items-center justify-content-between py-4 gap-3">
            <span className="footer-text">&copy; {new Date().getFullYear()} Nova AI &middot; ProArch</span>
            <span className="footer-text">Built with LiveKit &middot; Deepgram &middot; OpenAI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
