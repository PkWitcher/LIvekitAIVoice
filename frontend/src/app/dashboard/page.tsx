"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';
import {
  Phone,
  CheckCircle2,
  XCircle,
  PhoneOff,
  Clock,
  TrendingUp,
  LayoutDashboard,
  FileText,
  Settings,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
} from 'lucide-react';

// --- Types ---
interface Stats {
  total: number;
  completed: number;
  noAnswer: number;
  ringing: number;
  avgDuration: number;
  outbound: number;
  inbound: number;
  pickupRate: number;
}

interface DailyData {
  date: string;
  total: number;
  completed: number;
}

interface PreviousPeriod {
  total: number;
  completed: number;
  pickupRate: number;
}

interface CallLog {
  id: string;
  phone_number: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
}

interface UserSubscription {
  plan: string;
  status: string;
  max_calls_per_month: number;
  calls_used: number;
  max_minutes_per_month: number;
  minutes_used: number;
}

export default function DashboardPage() {
  const [activeNav, setActiveNav] = useState<string>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [previousPeriod, setPreviousPeriod] = useState<PreviousPeriod>({ total: 0, completed: 0, pickupRate: 0 });
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const router = useRouter();
  const supabase = createClient();

  // Theme
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  // Fetch user info + subscription
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const email = user.email || '';
      setUserName(email.split('@')[0] || 'User');

      const { data } = await supabase
        .from('user_subscriptions')
        .select('plan, status, max_calls_per_month, calls_used, max_minutes_per_month, minutes_used')
        .eq('user_id', user.id)
        .single();
      if (data) setSubscription(data);
    };
    fetchUser();
  }, []);

  // Fetch stats + calls
  const fetchData = useCallback(async () => {
    try {
      const [statsRes, callsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/calls'),
      ]);
      const statsData = await statsRes.json();
      const callsData = await callsRes.json();

      if (statsData.success) {
        setStats(statsData.stats);
        setDaily(statsData.daily || []);
        setPreviousPeriod(statsData.previousPeriod || { total: 0, completed: 0, pickupRate: 0 });
      }
      if (callsData.success) {
        setCalls(callsData.calls || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- Helpers ---
  const formatDuration = (s: number | null) => {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const formatNumber = (n: number) => n.toLocaleString('en-IN');

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '—';
    const pct = Math.round(((current - previous) / previous) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  };

  const timeAgo = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400';
      case 'failed':
        return 'bg-red-500/10 text-red-400';
      case 'no-answer':
        return 'bg-amber-500/10 text-amber-400';
      case 'ringing':
      case 'initiated':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'connected':
        return 'bg-blue-500/10 text-blue-400';
      default:
        return 'bg-white/[0.06] text-[#888]';
    }
  };

  const statusLabel = (s: string) => s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase());

  const userInitial = userName ? userName[0].toUpperCase() : 'U';
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

  // Compute failed count from stats
  const failed = stats ? stats.total - stats.completed - stats.noAnswer - stats.ringing : 0;
  const totalMinutes = stats ? Math.round((stats.avgDuration * stats.total) / 60) : 0;
  const successRate = stats && stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0';

  // Build last 7 days chart data
  const last7 = daily.slice(-7);
  const maxCompleted = Math.max(...last7.map(d => d.completed), 1);
  const maxFailed = Math.max(...last7.map(d => d.total - d.completed), 1);

  const getBarHeight = (value: number, max: number) => {
    const pct = Math.round((value / max) * 100);
    if (pct <= 0) return 'h-0';
    if (pct <= 10) return 'h-2';
    if (pct <= 20) return 'h-4';
    if (pct <= 30) return 'h-6';
    if (pct <= 40) return 'h-8';
    if (pct <= 50) return 'h-12';
    if (pct <= 60) return 'h-16';
    if (pct <= 70) return 'h-20';
    if (pct <= 80) return 'h-24';
    if (pct <= 90) return 'h-28';
    return 'h-32';
  };

  const dayLabel = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' });
  };

  // Subscription
  const hasSub = subscription && (subscription.status === 'active' || subscription.status === 'trial');
  const callsPct = subscription ? Math.min((subscription.calls_used / subscription.max_calls_per_month) * 100, 100) : 0;
  const minsPct = subscription ? Math.min((Math.round(Number(subscription.minutes_used)) / subscription.max_minutes_per_month) * 100, 100) : 0;

  const recentCalls = calls.slice(0, 5);
  const activeCalls = calls.filter(c => c.status === 'ringing' || c.status === 'connected').length;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div data-dashboard className="flex min-h-screen bg-[#050505] text-[#e5e5e5] font-[Inter,system-ui,sans-serif] antialiased">
      {/* Sidebar */}
      <aside className="w-60 border-r border-white/[0.04] bg-[#0a0a0a] flex flex-col justify-between px-4 py-5">
        <div>
          <div className="flex items-center gap-3 px-2 py-2 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Phone className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h1 className="font-semibold text-white text-sm leading-tight">Nova AI</h1>
              <span className="text-[10px] text-[#666] font-medium">Voice Platform</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveNav('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                activeNav === 'dashboard'
                  ? 'bg-white/[0.06] text-blue-400'
                  : 'text-[#888] hover:text-[#ccc] hover:bg-white/[0.03]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveNav('calls')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                activeNav === 'calls'
                  ? 'bg-white/[0.06] text-blue-400'
                  : 'text-[#888] hover:text-[#ccc] hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4" />
                <span>Calls</span>
              </div>
              {activeCalls > 0 && (
                <span className="bg-blue-500/15 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  {activeCalls}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveNav('transcripts')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                activeNav === 'transcripts'
                  ? 'bg-white/[0.06] text-blue-400'
                  : 'text-[#888] hover:text-[#ccc] hover:bg-white/[0.03]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Transcripts</span>
            </button>

            <button
              onClick={() => setActiveNav('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                activeNav === 'settings'
                  ? 'bg-white/[0.06] text-blue-400'
                  : 'text-[#888] hover:text-[#ccc] hover:bg-white/[0.03]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/[0.04]">
          <div className="flex items-center gap-3 px-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white font-medium flex items-center justify-center text-xs shadow-md shadow-blue-500/20">
              {userInitial}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{displayName}</p>
              <p className="text-[10px] text-[#666]">{hasSub ? `${subscription!.plan.charAt(0).toUpperCase() + subscription!.plan.slice(1)} Plan` : 'No Plan'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400/80 hover:bg-red-500/[0.06] transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="flex items-center justify-between px-8 py-4 border-b border-white/[0.04]">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Dashboard</h2>
            <p className="text-xs text-[#666] mt-0.5">Welcome back, {displayName}!</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={toggleTheme} className="p-2 rounded-lg text-[#666] hover:text-[#aaa] hover:bg-white/[0.04] transition-colors" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button className="relative p-2 rounded-lg text-[#666] hover:text-[#aaa] hover:bg-white/[0.04] transition-colors">
              <Bell className="w-4 h-4" />
              {activeCalls > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {activeCalls}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 pl-3 ml-1 cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-[11px] font-medium">
                {userInitial}
              </div>
              <span className="text-xs font-medium text-[#aaa]">{displayName}</span>
              <ChevronDown className="w-3 h-3 text-[#555]" />
            </div>
          </div>
        </header>

        <div className="px-8 py-6 space-y-7 max-w-7xl">
          {/* Metrics */}
          {loading ? (
            <div className="text-center py-12 text-[#555] text-sm">Loading dashboard…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
                {[
                  { title: 'TOTAL CALLS', value: formatNumber(stats?.total ?? 0), change: calcChange(stats?.total ?? 0, previousPeriod.total), isPos: (stats?.total ?? 0) >= previousPeriod.total, sub: 'This month', icon: Phone },
                  { title: 'COMPLETED', value: formatNumber(stats?.completed ?? 0), change: calcChange(stats?.completed ?? 0, previousPeriod.completed), isPos: (stats?.completed ?? 0) >= previousPeriod.completed, sub: stats && stats.total > 0 ? `${((stats.completed / stats.total) * 100).toFixed(1)}% rate` : '0% rate', icon: CheckCircle2 },
                  { title: 'FAILED', value: formatNumber(Math.max(failed, 0)), change: '—', isPos: true, sub: stats && stats.total > 0 ? `${((Math.max(failed, 0) / stats.total) * 100).toFixed(1)}% rate` : '0% rate', icon: XCircle },
                  { title: 'NO ANSWER', value: formatNumber(stats?.noAnswer ?? 0), change: '—', isPos: true, sub: stats && stats.total > 0 ? `${((stats.noAnswer / stats.total) * 100).toFixed(1)}% rate` : '0% rate', icon: PhoneOff },
                  { title: 'TOTAL MINUTES', value: formatNumber(totalMinutes), change: '—', isPos: true, sub: stats && stats.total > 0 ? `~${(stats.avgDuration / 60).toFixed(1)}/call` : '—', icon: Clock },
                  { title: 'SUCCESS RATE', value: `${successRate}%`, change: stats ? `${previousPeriod.pickupRate > 0 ? (Number(successRate) > previousPeriod.pickupRate ? '+' : '') + (Number(successRate) - previousPeriod.pickupRate).toFixed(1) + '%' : '—'}` : '—', isPos: Number(successRate) >= previousPeriod.pickupRate, sub: previousPeriod.pickupRate > 0 ? `vs ${previousPeriod.pickupRate}% last mo` : 'This month', icon: TrendingUp },
                ].map((m, i) => {
                  const Icon = m.icon;
                  return (
                    <div key={i} className="bg-white/[0.03] border border-white/[0.04] p-4 rounded-xl flex flex-col justify-between transition-all hover:bg-white/[0.05]">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-semibold tracking-wider text-[#666] uppercase">{m.title}</span>
                        <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-[#555]">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-white tracking-tight">{m.value}</span>
                          {m.change !== '—' && (
                            <span className={`text-[11px] font-medium ${m.isPos ? 'text-emerald-400' : 'text-red-400'}`}>{m.change}</span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#555] mt-1 block">{m.sub}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Middle Row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
                {/* Subscription Card */}
                <div className="lg:col-span-4 bg-white/[0.03] border border-white/[0.04] rounded-xl p-5 flex flex-col justify-between">
                  {hasSub ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white text-sm">Subscription</h3>
                        <span className="bg-blue-500/10 text-blue-400 text-[11px] px-2.5 py-0.5 rounded-full font-medium capitalize">
                          {subscription!.plan} Plan
                        </span>
                      </div>
                      <div className="space-y-4 mt-5">
                        <div>
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-[#888]">Calls Used</span>
                            <span className="text-[#aaa] font-medium">{formatNumber(subscription!.calls_used)} / {formatNumber(subscription!.max_calls_per_month)}</span>
                          </div>
                          <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full" style={{ width: `${callsPct}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-[#888]">Minutes Used</span>
                            <span className="text-[#aaa] font-medium">{formatNumber(Math.round(Number(subscription!.minutes_used)))} / {formatNumber(subscription!.max_minutes_per_month)}</span>
                          </div>
                          <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full" style={{ width: `${minsPct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-semibold text-white text-sm">No Active Plan</h3>
                      <p className="text-[#555] text-xs mt-2">Contact admin to activate your subscription.</p>
                    </div>
                  )}
                  <button className="w-full mt-5 py-2.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 text-xs font-semibold tracking-wide transition-all shadow-md shadow-blue-500/20">
                    Upgrade Plan
                  </button>
                </div>

                {/* Volume Chart */}
                <div className="lg:col-span-8 bg-white/[0.03] border border-white/[0.04] rounded-xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white text-sm">Call Volume — Last 7 Days</h3>
                    <div className="flex items-center gap-5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[#666] text-[11px]">Completed</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400/60" />
                        <span className="text-[#666] text-[11px]">Failed</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-4 items-end h-40 pt-6">
                    {last7.length > 0 ? last7.map((d) => (
                      <div key={d.date} className="flex flex-col items-center gap-2 h-full justify-end">
                        <div className="flex items-end gap-1 w-full justify-center">
                          <div className={`w-7 rounded-md bg-gradient-to-t from-blue-600/80 to-blue-400/80 ${getBarHeight(d.completed, maxCompleted)}`} />
                          <div className={`w-3 rounded-sm bg-red-400/40 ${getBarHeight(d.total - d.completed, maxFailed)}`} />
                        </div>
                        <span className="text-[11px] text-[#555] font-medium">{dayLabel(d.date)}</span>
                      </div>
                    )) : (
                      <div className="col-span-7 flex items-center justify-center h-full text-[#555] text-xs">No data yet</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white/[0.03] border border-white/[0.04] rounded-xl p-5">
                <div className="flex items-center justify-between pb-3">
                  <h3 className="font-semibold text-white text-sm">Recent Activity</h3>
                  <button onClick={() => setActiveNav('calls')} className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    View all calls →
                  </button>
                </div>
                <div className="overflow-x-auto mt-1">
                  {recentCalls.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.04] text-[10px] font-semibold uppercase text-[#555] tracking-wider">
                          <th className="py-3.5 px-3 font-semibold">Phone Number</th>
                          <th className="py-3.5 px-3 font-semibold">Time</th>
                          <th className="py-3.5 px-3 font-semibold">Duration</th>
                          <th className="py-3.5 px-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-[13px]">
                        {recentCalls.map((call) => (
                          <tr key={call.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-4 px-3 font-medium text-white">{call.phone_number}</td>
                            <td className="py-4 px-3 text-[#888]">{timeAgo(call.created_at)}</td>
                            <td className="py-4 px-3 text-[#888]">{formatDuration(call.duration_seconds)}</td>
                            <td className="py-4 px-3">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${getStatusBadge(call.status)}`}>
                                {statusLabel(call.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-[#555] text-xs py-6 text-center">No calls yet. Dispatch a call to see activity here.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
