"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserStats {
  user_id: string;
  email: string;
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

  if (loading) {
    return (
      <div className="page-bg page-bg-purple flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="spinner" />
          <span className="text-[var(--color-text-secondary)]">Loading admin panel...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-bg page-bg-purple flex items-center justify-center">
        <div className="card p-6 max-w-sm text-center">
          <div className="w-10 h-10 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-bg page-bg-purple">
      {/* Top bar */}
      <header className="glass-header px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-white">Admin Panel</h1>
              <p className="text-[10px] text-[var(--color-text-muted)] hidden sm:block">Nova AI — User Management</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs sm:text-sm text-[var(--color-text-secondary)] hover:text-red-400 transition-all px-3 sm:px-4 py-2 rounded-xl border border-[var(--color-border)] hover:border-red-500/30 hover:bg-red-500/5"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 animate-in">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Total Users</p>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.total_users ?? 0}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Total Calls</p>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.total_calls ?? 0}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Total Minutes</p>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white">{Math.round((stats?.total_minutes ?? 0))}</p>
          </div>
        </div>

        {/* Users Table */}
        <div className="card overflow-hidden animate-in animate-in-delay-1 !p-0">
          <div className="p-5 sm:p-6 border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">User Activity</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Call usage breakdown per user</p>
              </div>
              <span className="badge badge-purple">
                {stats?.users.length ?? 0} users
              </span>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th className="text-left">User</th>
                  <th className="text-center">Total Calls</th>
                  <th className="text-center">Completed</th>
                  <th className="text-center">Failed</th>
                  <th className="text-center">No Answer</th>
                  <th className="text-center">Total Duration</th>
                  <th className="text-center">Avg Duration</th>
                  <th className="text-center">Last Call</th>
                </tr>
              </thead>
              <tbody>
                {stats?.users.map((user) => (
                  <tr key={user.user_id}>
                    <td className="text-left">
                      <span className="text-white font-medium">{user.email}</span>
                    </td>
                    <td className="text-center text-white font-semibold">{user.total_calls}</td>
                    <td className="text-center">
                      <span className="text-green-400">{user.completed_calls}</span>
                    </td>
                    <td className="text-center">
                      <span className="text-red-400">{user.failed_calls}</span>
                    </td>
                    <td className="text-center">
                      <span className="text-yellow-400">{user.no_answer_calls}</span>
                    </td>
                    <td className="text-center text-white">{formatDuration(user.total_duration_seconds)}</td>
                    <td className="text-center text-[var(--color-text-secondary)]">{formatDuration(user.avg_duration_seconds)}</td>
                    <td className="text-center text-[var(--color-text-secondary)] text-xs">{formatDate(user.last_call_at)}</td>
                  </tr>
                ))}
                {(!stats?.users || stats.users.length === 0) && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-[var(--color-text-muted)]">
                      No user activity yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-[var(--color-border)]">
            {stats?.users.map((user) => (
              <div key={user.user_id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium truncate max-w-[200px]">{user.email}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{formatDate(user.last_call_at)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                    <p className="text-lg font-bold text-white">{user.total_calls}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Total</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                    <p className="text-lg font-bold text-green-400">{user.completed_calls}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Done</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                    <p className="text-lg font-bold text-red-400">{user.failed_calls}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Failed</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                  <span>Duration: {formatDuration(user.total_duration_seconds)}</span>
                  <span>Avg: {formatDuration(user.avg_duration_seconds)}</span>
                </div>
              </div>
            ))}
            {(!stats?.users || stats.users.length === 0) && (
              <div className="p-8 text-center text-sm text-[var(--color-text-muted)]">
                No user activity yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
