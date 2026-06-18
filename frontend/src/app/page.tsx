import CallDispatcher from "@/components/CallDispatcher";
import BulkDialer from "@/components/BulkDialer";

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* ── Ambient background lights ───────────── */}
      <div
        className="ambient-light animate-slow-drift"
        style={{
          top: "-10%",
          left: "10%",
          width: "600px",
          height: "600px",
          background:
            "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
        }}
      />
      <div
        className="ambient-light animate-slow-drift-reverse"
        style={{
          bottom: "0%",
          right: "5%",
          width: "500px",
          height: "500px",
          background:
            "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
        }}
      />
      <div
        className="ambient-light animate-slow-drift"
        style={{
          top: "40%",
          left: "50%",
          width: "400px",
          height: "400px",
          background:
            "radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)",
        }}
      />

      {/* ── Grid overlay ────────────────────────── */}
      <div className="grid-pattern fixed inset-0 pointer-events-none" />

      {/* ── Content ─────────────────────────────── */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        {/* ── Navbar ──────────────────────────── */}
        <nav className="flex items-center justify-between mb-12 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Nova AI</h1>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest">Voice Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-dot" />
              <span className="text-xs font-medium text-green-400 tracking-wide">Live</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
                Deepgram
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60" />
                Groq
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400/60" />
                SIP
              </span>
            </div>
          </div>
        </nav>

        {/* ── Hero Section ────────────────────── */}
        <header className="text-center mb-12 animate-fade-in-up">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
            <span className="text-white/90">Intelligent </span>
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              Voice Automation
            </span>
          </h2>

          <p className="mt-4 text-sm sm:text-base text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed">
            Dispatch AI-powered phone calls at scale. Our voice agents handle conversations
            naturally — from appointment reminders to customer outreach — so your team can focus on what matters.
          </p>
        </header>

        {/* ── Stats Row ───────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10 animate-fade-in-up-delay">
          {[
            { label: "Avg Latency", value: "~800ms", icon: "⚡" },
            { label: "Cost/Min", value: "₹1.26", icon: "💰" },
            { label: "Languages", value: "10+", icon: "🌐" },
            { label: "Uptime", value: "99.9%", icon: "🛡️" },
          ].map((stat) => (
            <div key={stat.label} className="stat-card glass-card px-4 py-4 text-center">
              <div className="text-lg mb-1">{stat.icon}</div>
              <div className="text-xl sm:text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── Cards Grid ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up-delay">
          <CallDispatcher />
          <BulkDialer />
        </div>

        {/* ── How It Works ────────────────────── */}
        <section className="mt-16 animate-fade-in-up-delay">
          <h3 className="text-center text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mb-8">How It Works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                step: "01",
                title: "Configure",
                desc: "Enter phone number, choose voice & model, add optional context.",
                color: "blue",
              },
              {
                step: "02",
                title: "Dispatch",
                desc: "AI agent places the call via SIP trunk to any phone network.",
                color: "purple",
              },
              {
                step: "03",
                title: "Converse",
                desc: "Real-time STT → LLM → TTS pipeline handles the full conversation.",
                color: "green",
              },
            ].map((item) => (
              <div key={item.step} className="glass-card p-5 group hover:scale-[1.02] transition-transform duration-300">
                <div className={`text-xs font-bold text-${item.color}-400 mb-2 tracking-widest`}>STEP {item.step}</div>
                <h4 className="text-white font-semibold mb-1.5">{item.title}</h4>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ──────────────────────────── */}
        <footer className="text-center mt-16 pb-6 space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="w-1 h-1 rounded-full bg-gradient-to-r from-blue-400 to-purple-400" />
            <span>Powered by LiveKit &middot; Deepgram &middot; Groq</span>
            <span className="w-1 h-1 rounded-full bg-gradient-to-r from-purple-400 to-green-400" />
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]/50">
            &copy; {new Date().getFullYear()} Nova AI Voice Platform. Built by ProArch.
          </p>
        </footer>
      </main>
    </div>
  );
}
