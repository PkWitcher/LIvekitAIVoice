import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* ── Ambient Glow ── */}
      <div className="landing-glow">
        <div className="glow-orb glow-orb-top" />
        <div className="glow-orb glow-orb-bottom" />
      </div>

      {/* ── Nav ── */}
      <nav className="landing-nav">
        <div className="container">
          <div className="d-flex align-items-center justify-content-between">
            <Link href="/" className="d-flex align-items-center gap-2 gap-sm-3 text-decoration-none">
              <div className="nav-logo">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
              </div>
              <span className="text-white fw-semibold" style={{fontSize: '0.85rem', whiteSpace: 'nowrap'}}>Nova AI</span>
            </Link>
            <div className="d-flex align-items-center gap-4">
              <a href="#features" className="nav-link-custom d-none d-md-block">Features</a>
              <a href="#how-it-works" className="nav-link-custom d-none d-md-block">How It Works</a>
              <Link href="/admin/login" className="nav-link-custom d-none d-md-block">Admin</Link>
              <ThemeToggle />
              <Link href="/login" className="btn-glow">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

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
