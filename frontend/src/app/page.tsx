import CallDispatcher from "@/components/CallDispatcher";
import BulkDialer from "@/components/BulkDialer";
import CallHistory from "@/components/CallHistory";

export default function Home() {
  return (
    <div className="min-h-screen">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* ── Header ─────────────────────────── */}
        <header className="flex items-center justify-between mb-10 sm:mb-14">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white leading-tight">Nova AI</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Voice Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-border)]">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-[var(--color-text-secondary)]">System Online</span>
          </div>
        </header>

        {/* ── Title ──────────────────────────── */}
        <div className="mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
            AI Voice Calls
          </h2>
          <p className="text-sm sm:text-base text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
            Place AI-powered phone calls that handle real conversations — appointment reminders,
            customer outreach, and more.
          </p>
        </div>

        {/* ── Cards ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <CallDispatcher />
          <BulkDialer />
        </div>

        {/* ── Call History ────────────────────── */}
        <div className="mt-10 sm:mt-14">
          <CallHistory />
        </div>

        {/* ── Footer ─────────────────────────── */}
        <footer className="mt-16 sm:mt-20 pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
          <span>&copy; {new Date().getFullYear()} Nova AI &middot; ProArch</span>
          <span>LiveKit &middot; Deepgram &middot; Groq</span>
        </footer>
      </main>
    </div>
  );
}
