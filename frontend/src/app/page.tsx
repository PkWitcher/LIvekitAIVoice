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
