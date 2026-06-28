"use client";

import { useState } from "react";
import CallDispatcher from "@/components/CallDispatcher";
import BulkDialer from "@/components/BulkDialer";
import CallHistory from "@/components/CallHistory";
import DashboardStats from "@/components/DashboardStats";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";

type Tab = "dashboard" | "calls" | "settings";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  return (
    <div className="page-bg">
      {/* ── Sidebar + Main Layout ── */}
      <div className="flex h-screen overflow-hidden">
        {/* ── Sidebar (fixed, not scrollable) ── */}
        <aside className="hidden lg:flex flex-col w-64 h-screen border-r border-[var(--color-border)] bg-[#080808]/80 backdrop-blur-xl px-4 py-6 relative z-10 shrink-0">
          <Link href="/" className="flex items-center gap-3 mb-10 px-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-tight">Nova AI</h1>
              <p className="text-[10px] text-[var(--color-text-muted)]">Voice Platform</p>
            </div>
          </Link>

          <nav className="space-y-1 flex-1">
            <button onClick={() => setActiveTab("dashboard")} className={`sidebar-link w-full text-left ${activeTab === "dashboard" ? "active" : ""}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
              </svg>
              Dashboard
            </button>
            <button onClick={() => setActiveTab("calls")} className={`sidebar-link w-full text-left ${activeTab === "calls" ? "active" : ""}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              Calls
            </button>
            <button onClick={() => setActiveTab("settings")} className={`sidebar-link w-full text-left ${activeTab === "settings" ? "active" : ""}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.204-.107-.397.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              Settings
            </button>
          </nav>

          <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between px-3 py-2">
              <LogoutButton />
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
              <span className="text-xs text-[var(--color-text-secondary)]">System Online</span>
            </div>
          </div>
        </aside>

        {/* ── Main Content (scrollable) ── */}
        <main className="flex-1 overflow-y-auto relative z-10">
          {/* Top bar for mobile */}
          <header className="lg:hidden glass-header flex items-center justify-between px-4 py-4 sticky top-0 z-20">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">Nova AI</span>
            </Link>
            {/* Mobile tab switcher */}
            <div className="flex items-center gap-1 bg-[var(--color-bg-input)] rounded-lg p-1 border border-[var(--color-border)]">
              <button onClick={() => setActiveTab("dashboard")} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${activeTab === "dashboard" ? "bg-blue-500/20 text-blue-400" : "text-[var(--color-text-muted)]"}`}>Dashboard</button>
              <button onClick={() => setActiveTab("calls")} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${activeTab === "calls" ? "bg-blue-500/20 text-blue-400" : "text-[var(--color-text-muted)]"}`}>Calls</button>
              <button onClick={() => setActiveTab("settings")} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${activeTab === "settings" ? "bg-blue-500/20 text-blue-400" : "text-[var(--color-text-muted)]"}`}>Settings</button>
            </div>
            <ThemeToggle />
          </header>

          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
            {/* ── Dashboard Tab ── */}
            {activeTab === "dashboard" && (
              <>
                <div className="animate-in">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 tracking-tight">
                    Dashboard
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Manage your AI voice calls, campaigns, and recordings.
                  </p>
                </div>

                <div className="animate-in animate-in-delay-1">
                  <DashboardStats />
                </div>

                <div className="animate-in animate-in-delay-2">
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 sm:mb-4">
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <CallDispatcher />
                    <BulkDialer />
                  </div>
                </div>

                <div className="animate-in animate-in-delay-3">
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
                    Recent Activity
                  </h3>
                  <CallHistory />
                </div>
              </>
            )}

            {/* ── Calls Tab ── */}
            {activeTab === "calls" && (
              <>
                <div className="animate-in">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 tracking-tight">
                    Calls
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Dispatch calls and view call history.
                  </p>
                </div>

                <div className="animate-in animate-in-delay-1 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <CallDispatcher />
                  <BulkDialer />
                </div>

                <div className="animate-in animate-in-delay-2">
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
                    Call History
                  </h3>
                  <CallHistory />
                </div>
              </>
            )}

            {/* ── Settings Tab ── */}
            {activeTab === "settings" && (
              <>
                <div className="animate-in">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 tracking-tight">
                    Settings
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Configure your voice platform preferences.
                  </p>
                </div>

                <div className="animate-in animate-in-delay-1 space-y-4">
                  {/* General Settings */}
                  <div className="stat-card">
                    <h3 className="text-sm font-semibold text-white mb-4">General</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">Theme</p>
                          <p className="text-xs text-[var(--color-text-muted)]">Switch between dark and light mode</p>
                        </div>
                        <ThemeToggle />
                      </div>
                      <div className="border-t border-[var(--color-border)]" />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">Notifications</p>
                          <p className="text-xs text-[var(--color-text-muted)]">Get notified when calls complete</p>
                        </div>
                        <div className="w-10 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 relative cursor-pointer">
                          <div className="w-4 h-4 rounded-full bg-blue-500 absolute top-0.5 right-0.5 shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Voice Settings */}
                  <div className="stat-card">
                    <h3 className="text-sm font-semibold text-white mb-4">Voice & AI</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">LLM Provider</p>
                          <p className="text-xs text-[var(--color-text-muted)]">Language model for AI responses</p>
                        </div>
                        <span className="text-xs text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">OpenAI</span>
                      </div>
                      <div className="border-t border-[var(--color-border)]" />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">TTS Provider</p>
                          <p className="text-xs text-[var(--color-text-muted)]">Text-to-speech engine</p>
                        </div>
                        <span className="text-xs text-purple-400 bg-purple-500/10 px-3 py-1 rounded-lg border border-purple-500/20">Cartesia</span>
                      </div>
                      <div className="border-t border-[var(--color-border)]" />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">STT Provider</p>
                          <p className="text-xs text-[var(--color-text-muted)]">Speech-to-text engine</p>
                        </div>
                        <span className="text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20">Deepgram</span>
                      </div>
                    </div>
                  </div>

                  {/* SIP Settings */}
                  <div className="stat-card">
                    <h3 className="text-sm font-semibold text-white mb-4">SIP Configuration</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">SIP Provider</p>
                          <p className="text-xs text-[var(--color-text-muted)]">Telephony provider for calls</p>
                        </div>
                        <span className="text-xs text-orange-400 bg-orange-500/10 px-3 py-1 rounded-lg border border-orange-500/20">Vobiz</span>
                      </div>
                      <div className="border-t border-[var(--color-border)]" />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-white">Status</p>
                          <p className="text-xs text-[var(--color-text-muted)]">SIP trunk connection status</p>
                        </div>
                        <span className="flex items-center gap-1.5 text-xs text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Connected
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
