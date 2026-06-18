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
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Header */}
        <header className="text-center mb-14 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/5 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-dot" />
            <span className="text-xs font-medium text-green-400 tracking-wide">
              System Online
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              Voice Agent
            </span>{" "}
            <span className="text-white/90">Dashboard</span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-[var(--color-text-secondary)] max-w-xl mx-auto leading-relaxed">
            AI-powered phone calls over PSTN. Dispatch single calls or launch
            bulk campaigns with real-time voice AI.
          </p>

          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
              Deepgram Nova-2
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60" />
              Groq Llama 3.3
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400/60" />
              LiveKit SIP
            </span>
          </div>
        </header>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up-delay">
          <CallDispatcher />
          <BulkDialer />
        </div>

        {/* Footer */}
        <footer className="text-center mt-16 text-xs text-[var(--color-text-muted)]">
          <p>
            Target cost:{" "}
            <span className="text-green-400 font-medium">₹1.26/min</span> per
            call &middot; Self-hosted LiveKit &middot; SIP Trunk
          </p>
        </footer>
      </main>
    </div>
  );
}
