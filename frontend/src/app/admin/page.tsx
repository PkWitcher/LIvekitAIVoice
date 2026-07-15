"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import UserSubscriptions from "@/components/UserSubscriptions";

interface UserStats {
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
  registered_at: string | null;
  total_calls: number;
  completed_calls: number;
  failed_calls: number;
  no_answer_calls: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  last_call_at: string | null;
}

interface AdminStats {
  total_users: number;
  total_calls: number;
  total_minutes: number;
  users: UserStats[];
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "subscriptions">("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.error || "Failed to fetch");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0m 0s";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    return new Date(iso).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const successRate = stats?.total_calls
    ? Math.round((stats.users.reduce((s, u) => s + u.completed_calls, 0) / stats.total_calls) * 100)
    : 0;

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-content">
          <div className="admin-loading-logo">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <div className="admin-loading-bar">
            <div className="admin-loading-bar-fill" />
          </div>
          <p>Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-loading">
        <div className="admin-error-card">
          <div className="admin-error-icon">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h3>Connection Error</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="admin-btn-retry">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-sidebar-header">
          <Link href="/" className="admin-brand">
            <div className="admin-brand-icon">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            </div>
            <div className="admin-brand-text">
              <span className="admin-brand-name">Nova AI</span>
              <span className="admin-brand-label">Admin Console</span>
            </div>
          </Link>
        </div>

        <nav className="admin-sidebar-nav">
          <p className="admin-nav-section-label">Dashboard</p>
          <button
            onClick={() => setActiveTab("overview")}
            className={`admin-nav-item ${activeTab === "overview" ? "active" : ""}`}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab("subscriptions")}
            className={`admin-nav-item ${activeTab === "subscriptions" ? "active" : ""}`}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
            <span>Subscriptions</span>
          </button>

          <p className="admin-nav-section-label" style={{ marginTop: "1.5rem" }}>Quick Stats</p>
          <div className="admin-sidebar-stats">
            <div className="admin-sidebar-stat">
              <span className="admin-sidebar-stat-value">{stats?.total_users ?? 0}</span>
              <span className="admin-sidebar-stat-label">Users</span>
            </div>
            <div className="admin-sidebar-stat">
              <span className="admin-sidebar-stat-value">{stats?.total_calls ?? 0}</span>
              <span className="admin-sidebar-stat-label">Calls</span>
            </div>
            <div className="admin-sidebar-stat">
              <span className="admin-sidebar-stat-value">{successRate}%</span>
              <span className="admin-sidebar-stat-label">Success</span>
            </div>
          </div>
        </nav>

        <div className="admin-sidebar-footer">
          <button onClick={handleLogout} className="admin-logout-btn">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="admin-main">
        {/* Top bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button className="admin-mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div>
              <h1 className="admin-page-title">
                {activeTab === "overview" ? "Dashboard Overview" : "Subscription Management"}
              </h1>
              <p className="admin-page-subtitle">
                {activeTab === "overview"
                  ? "Monitor user activity and system performance"
                  : "Manage plans, limits & billing per user"}
              </p>
            </div>
          </div>
          <div className="admin-topbar-right">
            <div className="admin-live-indicator">
              <span className="admin-live-dot" />
              <span>Live</span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Content Area */}
        <div className="admin-content">
          {activeTab === "overview" && (
            <>
              {/* Stats Grid */}
              <div className="admin-stats-grid animate-in">
                <div className="admin-stat-card admin-stat-blue">
                  <div className="admin-stat-icon">
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                  </div>
                  <div className="admin-stat-info">
                    <span className="admin-stat-number">{stats?.total_users ?? 0}</span>
                    <span className="admin-stat-label">Total Users</span>
                  </div>
                  <div className="admin-stat-badge">Registered</div>
                </div>

                <div className="admin-stat-card admin-stat-purple">
                  <div className="admin-stat-icon">
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                  </div>
                  <div className="admin-stat-info">
                    <span className="admin-stat-number">{stats?.total_calls ?? 0}</span>
                    <span className="admin-stat-label">Total Calls</span>
                  </div>
                  <div className="admin-stat-badge">All Time</div>
                </div>

                <div className="admin-stat-card admin-stat-amber">
                  <div className="admin-stat-icon">
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div className="admin-stat-info">
                    <span className="admin-stat-number">{Math.round(stats?.total_minutes ?? 0)}</span>
                    <span className="admin-stat-label">Total Minutes</span>
                  </div>
                  <div className="admin-stat-badge">Talk Time</div>
                </div>

                <div className="admin-stat-card admin-stat-green">
                  <div className="admin-stat-icon">
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div className="admin-stat-info">
                    <span className="admin-stat-number">{successRate}%</span>
                    <span className="admin-stat-label">Success Rate</span>
                  </div>
                  <div className="admin-stat-badge">Completed</div>
                </div>
              </div>

              {/* Users Table */}
              <div className="admin-card animate-in animate-in-delay-1">
                <div className="admin-card-header">
                  <div>
                    <h2 className="admin-card-title">All Users</h2>
                    <p className="admin-card-subtitle">Complete details for each registered user</p>
                  </div>
                  <span className="badge badge-purple">
                    {stats?.users.length ?? 0} users
                  </span>
                </div>

                {/* Desktop table — hidden, replaced by user cards below */}
                <div className="hidden">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th className="text-left">User</th>
                        <th className="text-center">Phone</th>
                        <th className="text-center">Total</th>
                        <th className="text-center">Completed</th>
                        <th className="text-center">Failed</th>
                        <th className="text-center">No Answer</th>
                        <th className="text-center">Duration</th>
                        <th className="text-center">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.users.map((user) => (
                        <tr key={user.user_id}>
                          <td className="text-left">
                            <div className="admin-user-cell">
                              <div className="admin-avatar">
                                {(user.full_name || user.email)?.charAt(0) || "?"}
                              </div>
                              <div className="admin-user-info">
                                {user.full_name && <span className="admin-user-name">{user.full_name}</span>}
                                <span className="admin-user-email">{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="text-center">
                            <span className="admin-table-muted text-xs font-mono">{user.phone || "—"}</span>
                          </td>
                          <td className="text-center">
                            <span className="admin-table-value">{user.total_calls}</span>
                          </td>
                          <td className="text-center">
                            <span className="admin-table-status admin-status-success">
                              <span className="admin-status-dot green" />
                              {user.completed_calls}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="admin-table-status admin-status-error">
                              <span className="admin-status-dot red" />
                              {user.failed_calls}
                            </span>
                          </td>
                          <td className="text-center">
                            <span className="admin-table-status admin-status-warning">
                              <span className="admin-status-dot yellow" />
                              {user.no_answer_calls}
                            </span>
                          </td>
                          <td className="text-center admin-table-secondary">{formatDuration(user.total_duration_seconds)}</td>
                          <td className="text-center admin-table-muted text-xs">{formatDate(user.last_call_at)}</td>
                        </tr>
                      ))}
                      {(!stats?.users || stats.users.length === 0) && (
                        <tr>
                          <td colSpan={8} className="admin-table-empty">
                            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="opacity-30">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 3.75v4.5m0-4.5h-4.5m4.5 0-6 6m3 12c-8.284 0-15-6.716-15-15V2.25A2.25 2.25 0 0 1 4.5 0h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.055.902-.417 1.173l-1.293.97a1.062 1.062 0 0 0-.38 1.21 12.035 12.035 0 0 0 7.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 0 1 1.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 0 1-2.25 2.25h-2.25Z" />
                            </svg>
                            <span>No user activity yet</span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* User Detail Cards — visible on all screens */}
                <div className="admin-user-cards-grid">
                  {stats?.users.map((user) => (
                    <div key={user.user_id} className="admin-mobile-card">
                      <div className="admin-mobile-card-header">
                        <div className="admin-user-cell">
                          <div className="admin-avatar">
                            {(user.full_name || user.email)?.charAt(0) || "?"}
                          </div>
                          <div className="admin-user-info">
                            {user.full_name && <span className="admin-user-name">{user.full_name}</span>}
                            <span className="admin-user-email">{user.email}</span>
                            {user.phone && <span className="admin-user-phone">{user.phone}</span>}
                          </div>
                        </div>
                        <div className="admin-user-card-meta">
                          <span className="admin-mobile-date">Joined: {formatDate(user.registered_at)}</span>
                          <span className="admin-mobile-date">Last: {formatDate(user.last_call_at)}</span>
                        </div>
                      </div>
                      <div className="admin-mobile-stats-grid">
                        <div className="admin-mobile-stat">
                          <span className="admin-mobile-stat-value">{user.total_calls}</span>
                          <span className="admin-mobile-stat-label">Total</span>
                        </div>
                        <div className="admin-mobile-stat success">
                          <span className="admin-mobile-stat-value">{user.completed_calls}</span>
                          <span className="admin-mobile-stat-label">Done</span>
                        </div>
                        <div className="admin-mobile-stat error">
                          <span className="admin-mobile-stat-value">{user.failed_calls}</span>
                          <span className="admin-mobile-stat-label">Failed</span>
                        </div>
                        <div className="admin-mobile-stat warning">
                          <span className="admin-mobile-stat-value">{user.no_answer_calls}</span>
                          <span className="admin-mobile-stat-label">Missed</span>
                        </div>
                      </div>
                      <div className="admin-mobile-card-footer">
                        <span>
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                          Total: {formatDuration(user.total_duration_seconds)}
                        </span>
                        <span>Avg: {formatDuration(user.avg_duration_seconds)}</span>
                      </div>
                      {user.phone && (
                        <div className="admin-user-card-extra">
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                          </svg>
                          <span className="font-mono text-xs">{user.phone}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {(!stats?.users || stats.users.length === 0) && (
                    <div className="admin-table-empty" style={{ padding: "3rem" }}>
                      <span>No user activity yet</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "subscriptions" && (
            <div className="animate-in">
              <UserSubscriptions
                users={(stats?.users || []).map((u) => ({ user_id: u.user_id, email: u.email }))}
              />
            </div>
          )}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="admin-mobile-bottom-nav">
        <button
          onClick={() => { setActiveTab("overview"); setSidebarOpen(false); }}
          className={`admin-bottom-nav-item ${activeTab === "overview" ? "active" : ""}`}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
          </svg>
          <span>Overview</span>
        </button>
        <button
          onClick={() => { setActiveTab("subscriptions"); setSidebarOpen(false); }}
          className={`admin-bottom-nav-item ${activeTab === "subscriptions" ? "active" : ""}`}
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
          </svg>
          <span>Plans</span>
        </button>
        <button
          onClick={handleLogout}
          className="admin-bottom-nav-item"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          <span>Logout</span>
        </button>
      </nav>
    </div>
  );
}
