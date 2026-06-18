import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] overflow-hidden">
      {/* ── Ambient Glow ── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/[0.07] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-600/[0.05] rounded-full blur-[100px]" />
      </div>

      {/* ── Nav ── */}
      <nav className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
            </svg>
          </div>
          <span className="text-xl font-semibold text-white tracking-tight">Nova AI</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="hidden sm:block text-sm text-[#888] hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hidden sm:block text-sm text-[#888] hover:text-white transition-colors">How It Works</a>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/25"
          >
            Open Dashboard
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 sm:pt-32 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#222] bg-[#0a0a0a] mb-8">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-[#888] font-medium">AI-Powered Voice Automation</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-6 max-w-4xl mx-auto">
          Automate phone calls with{" "}
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            AI that speaks naturally
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-[#888] max-w-2xl mx-auto mb-10 leading-relaxed">
          Deploy intelligent voice agents that make real phone calls — appointment reminders,
          customer outreach, follow-ups — all automated with human-like conversations.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="px-8 py-3.5 rounded-xl text-base font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            Go to Dashboard
          </Link>
          <a
            href="#features"
            className="px-8 py-3.5 rounded-xl text-base font-medium text-[#ccc] border border-[#333] hover:border-[#555] hover:text-white transition-all"
          >
            Learn More
          </a>
        </div>

        {/* Hero Stats */}
        <div className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto">
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white">500+</div>
            <div className="text-xs sm:text-sm text-[#666] mt-1">Calls Made</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white">{'<'}₹2</div>
            <div className="text-xs sm:text-sm text-[#666] mt-1">Per Minute</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-white">98%</div>
            <div className="text-xs sm:text-sm text-[#666] mt-1">Uptime</div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything you need for AI calling
          </h2>
          <p className="text-[#888] text-lg max-w-xl mx-auto">
            A complete voice automation platform built for scale and simplicity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                </svg>
              ),
              title: "Natural Voice AI",
              desc: "Human-like speech powered by Deepgram TTS with multiple voice options — male and female.",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
                </svg>
              ),
              title: "Bulk Campaigns",
              desc: "Dial hundreds of numbers in one click with customizable scripts for each campaign.",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              ),
              title: "Live Call Tracking",
              desc: "Real-time status updates — ringing, connected, completed, no-answer — with 1s refresh.",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              ),
              title: "Call Recording",
              desc: "Every answered call is recorded automatically. Play back recordings from the dashboard.",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
              ),
              title: "Ultra Low Cost",
              desc: "Under ₹2 per minute using Groq (free LLM) + Deepgram (pay-per-use STT/TTS).",
            },
            {
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              ),
              title: "Self-Hosted & Secure",
              desc: "100% self-hosted on your infrastructure. No data leaves your servers — full control.",
            },
          ].map((f, i) => (
            <div
              key={i}
              className="group p-6 rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] hover:border-[#333] hover:bg-[#0d0d0d] transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center text-blue-400 mb-4 group-hover:border-blue-500/30 group-hover:bg-blue-500/5 transition-colors">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-[#888] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="relative z-10 max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            How it works
          </h2>
          <p className="text-[#888] text-lg">Three simple steps to automated calling.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: "01", title: "Enter Numbers", desc: "Add phone numbers individually or in bulk via the dashboard." },
            { step: "02", title: "Set Your Script", desc: "Write a prompt for what the AI should say and how it should respond." },
            { step: "03", title: "Launch & Monitor", desc: "Hit dial and watch real-time status updates with call recordings." },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-5xl font-bold bg-gradient-to-b from-[#333] to-[#111] bg-clip-text text-transparent mb-4">
                {s.step}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-[#888] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-16 border-t border-[#111]">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-widest text-[#555] font-medium">Powered By</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 text-[#555]">
          {["LiveKit", "Deepgram", "Groq", "Supabase", "Next.js", "Docker"].map((t) => (
            <span key={t} className="text-sm font-medium hover:text-[#888] transition-colors">{t}</span>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Ready to automate your calls?
        </h2>
        <p className="text-[#888] text-lg mb-8 max-w-xl mx-auto">
          Open the dashboard and make your first AI call in under a minute.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex px-8 py-3.5 rounded-xl text-base font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5"
        >
          Open Dashboard
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 max-w-6xl mx-auto px-6 py-8 border-t border-[#111] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#555]">
        <span>&copy; {new Date().getFullYear()} Nova AI &middot; ProArch</span>
        <span>Built with LiveKit &middot; Deepgram &middot; Groq</span>
      </footer>
    </div>
  );
}
