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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <div className="text-[var(--color-text-secondary)]">Loading admin panel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050505" }}>
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#050505" }}>
      {/* Top bar */}
      <header className="border-b border-[var(--color-border)] px-4 sm:px-6 py-3 sm:py-4">
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
            className="text-xs sm:text-sm text-[var(--color-text-secondary)] hover:text-red-400 transition px-2 sm:px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:border-red-500/30"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="card p-4 sm:p-5">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Total Users</p>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.total_users ?? 0}</p>
          </div>
          <div className="card p-4 sm:p-5">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Total Calls</p>
            <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.total_calls ?? 0}</p>
          </div>
          <div className="card p-4 sm:p-5">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Total Minutes Used</p>
            <p className="text-2xl sm:text-3xl font-bold text-white">{Math.round((stats?.total_minutes ?? 0))}</p>
          </div>
        </div>

        {/* Users Table */}
        <div className="card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[var(--color-border)]">
            <h2 className="text-base font-semibold text-white">User Activity</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Call usage breakdown per user</p>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-center px-4 py-3 font-medium">Total Calls</th>
                  <th className="text-center px-4 py-3 font-medium">Completed</th>
                  <th className="text-center px-4 py-3 font-medium">Failed</th>
                  <th className="text-center px-4 py-3 font-medium">No Answer</th>
                  <th className="text-center px-4 py-3 font-medium">Total Duration</th>
                  <th className="text-center px-4 py-3 font-medium">Avg Duration</th>
                  <th className="text-center px-4 py-3 font-medium">Last Call</th>
                </tr>
              </thead>
              <tbody>
                {stats?.users.map((user) => (
                  <tr key={user.user_id} className="border-b border-[var(--color-border)] hover:bg-white/[0.02] transition">
                    <td className="px-5 py-3">
                      <span className="text-white font-medium">{user.email}</span>
                    </td>
                    <td className="text-center px-4 py-3 text-white">{user.total_calls}</td>
                    <td className="text-center px-4 py-3">
                      <span className="text-green-400">{user.completed_calls}</span>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className="text-red-400">{user.failed_calls}</span>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className="text-yellow-400">{user.no_answer_calls}</span>
                    </td>
                    <td className="text-center px-4 py-3 text-white">{formatDuration(user.total_duration_seconds)}</td>
                    <td className="text-center px-4 py-3 text-[var(--color-text-secondary)]">{formatDuration(user.avg_duration_seconds)}</td>
                    <td className="text-center px-4 py-3 text-[var(--color-text-secondary)] text-xs">{formatDate(user.last_call_at)}</td>
                  </tr>
                ))}
                {(!stats?.users || stats.users.length === 0) && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-[var(--color-text-muted)]">
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
