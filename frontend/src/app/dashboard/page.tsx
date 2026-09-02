"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CallHistory from '@/components/CallHistory';
import CallDispatcher from '@/components/CallDispatcher';
import BulkDialer from '@/components/BulkDialer';
import TranscriptHistory from '@/components/TranscriptHistory';
import UpgradePlan from '@/components/UpgradePlan';
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
  Sparkles,
  Zap,
  ArrowUpRight,
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

type ChartPeriod = "7d" | "1m" | "6m" | "1y";

const chartPeriodLabels: Record<ChartPeriod, string> = {
  "7d": "Last 7 Days",
  "1m": "Last Month",
  "6m": "Last 6 Months",
  "1y": "Last Year",
};

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
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("7d");
  const [previousPeriod, setPreviousPeriod] = useState<PreviousPeriod>({ total: 0, completed: 0, pickupRate: 0 });
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [profileOpen, setProfileOpen] = useState(false);
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
        fetch(`/api/stats?period=${chartPeriod}`),
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
  }, [chartPeriod]);

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

  const chartDays = daily;
  const maxCompleted = Math.max(...chartDays.map(d => d.completed), 1);
  const maxFailed = Math.max(...chartDays.map(d => d.total - d.completed), 1);

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
    <div data-dashboard className="dash-root">
      {/* Background Effects */}
      <div className="dash-bg-effects">
        <div className="dash-glow dash-glow-1" />
        <div className="dash-glow dash-glow-2" />
      </div>

      {/* Sidebar */}
      <aside className="dash-sidebar">
        <div>
          <Link href="/" className="dash-brand">
            <div className="dash-brand-icon">
              <Phone className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h1 className="dash-brand-title">Nova AI</h1>
              <span className="dash-brand-sub">Voice Platform</span>
            </div>
          </Link>

          <nav className="dash-nav">
            <button
              onClick={() => setActiveNav('dashboard')}
              className={`dash-nav-item ${activeNav === 'dashboard' ? 'active' : ''}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveNav('calls')}
              className={`dash-nav-item ${activeNav === 'calls' ? 'active' : ''}`}
            >
              <Phone className="w-4 h-4" />
              <span>Calls</span>
              {activeCalls > 0 && (
                <span className="dash-nav-badge">{activeCalls}</span>
              )}
            </button>

            <button
              onClick={() => setActiveNav('transcripts')}
              className={`dash-nav-item ${activeNav === 'transcripts' ? 'active' : ''}`}
            >
              <FileText className="w-4 h-4" />
              <span>Transcripts</span>
            </button>

            <button
              onClick={() => setActiveNav('settings')}
              className={`dash-nav-item ${activeNav === 'settings' ? 'active' : ''}`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        <div className="dash-sidebar-footer">
        </div>
      </aside>

      <main className="dash-main">
        {/* Header */}
        <header className="dash-header">
          <div>
            <h2 className="dash-header-title">{activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}</h2>
            <p className="dash-header-sub">{activeNav === 'dashboard' ? `Welcome back, ${displayName}!` : activeNav === 'calls' ? 'Manage and dispatch calls' : activeNav === 'transcripts' ? 'View call transcripts' : 'Account settings'}</p>
          </div>
          <div className="dash-header-actions">
            <button onClick={toggleTheme} className="dash-icon-btn" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button className="dash-icon-btn dash-notif-btn">
              <Bell className="w-4 h-4" />
              {activeCalls > 0 && (
                <span className="dash-notif-dot">{activeCalls}</span>
              )}
            </button>
            <div className="dash-profile-wrapper">
              <button onClick={() => setProfileOpen(!profileOpen)} className="dash-header-user">
                <div className="dash-avatar-sm">
                  {userInitial}
                </div>
                <span className="dash-header-username">{displayName}</span>
                <ChevronDown className={`w-3 h-3 text-[#555] transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {profileOpen && (
                <div className="dash-profile-dropdown">
                  <div className="dash-profile-info">
                    <div className="dash-avatar">
                      {userInitial}
                    </div>
                    <div>
                      <p className="dash-user-name">{displayName}</p>
                      <p className="dash-user-plan">{hasSub ? `${subscription!.plan.charAt(0).toUpperCase() + subscription!.plan.slice(1)} Plan` : 'No Plan'}</p>
                    </div>
                  </div>
                  <div className="dash-profile-divider" />
                  <button onClick={handleLogout} className="dash-logout-btn">
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dash-content">
          {activeNav === 'dashboard' && (
            <>
              {loading ? (
                <div className="dash-loading">
                  <div className="dash-loading-spinner" />
                  <span>Loading dashboard…</span>
                </div>
              ) : (
                <>
                  {/* Stats Grid */}
                  <div className="dash-stats-grid">
                    {[
                      { title: 'Total Calls', value: formatNumber(stats?.total ?? 0), change: calcChange(stats?.total ?? 0, previousPeriod.total), isPos: (stats?.total ?? 0) >= previousPeriod.total, sub: 'This month', icon: Phone, color: 'blue' },
                      { title: 'Completed', value: formatNumber(stats?.completed ?? 0), change: calcChange(stats?.completed ?? 0, previousPeriod.completed), isPos: (stats?.completed ?? 0) >= previousPeriod.completed, sub: stats && stats.total > 0 ? `${((stats.completed / stats.total) * 100).toFixed(1)}% rate` : '0% rate', icon: CheckCircle2, color: 'emerald' },
                      { title: 'Failed', value: formatNumber(Math.max(failed, 0)), change: '—', isPos: true, sub: stats && stats.total > 0 ? `${((Math.max(failed, 0) / stats.total) * 100).toFixed(1)}% rate` : '0% rate', icon: XCircle, color: 'red' },
                      { title: 'No Answer', value: formatNumber(stats?.noAnswer ?? 0), change: '—', isPos: true, sub: stats && stats.total > 0 ? `${((stats.noAnswer / stats.total) * 100).toFixed(1)}% rate` : '0% rate', icon: PhoneOff, color: 'amber' },
                      { title: 'Total Minutes', value: formatNumber(totalMinutes), change: '—', isPos: true, sub: stats && stats.total > 0 ? `~${(stats.avgDuration / 60).toFixed(1)}/call` : '—', icon: Clock, color: 'purple' },
                      { title: 'Success Rate', value: `${successRate}%`, change: stats ? `${previousPeriod.pickupRate > 0 ? (Number(successRate) > previousPeriod.pickupRate ? '+' : '') + (Number(successRate) - previousPeriod.pickupRate).toFixed(1) + '%' : '—'}` : '—', isPos: Number(successRate) >= previousPeriod.pickupRate, sub: previousPeriod.pickupRate > 0 ? `vs ${previousPeriod.pickupRate}% last mo` : 'This month', icon: TrendingUp, color: 'cyan' },
                    ].map((m, i) => {
                      const Icon = m.icon;
                      return (
                        <div key={i} className={`dash-stat-card dash-stat-${m.color}`}>
                          <div className="dash-stat-card-glow" />
                          <div className="dash-stat-header">
                            <span className="dash-stat-title">{m.title}</span>
                            <div className={`dash-stat-icon dash-stat-icon-${m.color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                          </div>
                          <div className="dash-stat-body">
                            <span className="dash-stat-value">{m.value}</span>
                            {m.change !== '—' && (
                              <span className={`dash-stat-change ${m.isPos ? 'positive' : 'negative'}`}>
                                {m.isPos ? <ArrowUpRight className="w-3 h-3" /> : null}
                                {m.change}
                              </span>
                            )}
                          </div>
                          <span className="dash-stat-sub">{m.sub}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Middle Row */}
                  <div className="dash-middle-row">
                    {/* Subscription Card */}
                    <div className="dash-card dash-subscription-card">
                      <div className="dash-card-shine" />
                      {hasSub ? (
                        <div>
                          <div className="dash-card-header">
                            <div className="dash-card-header-left">
                              <Sparkles className="w-4 h-4 text-blue-400" />
                              <h3 className="dash-card-title">Subscription</h3>
                            </div>
                            <span className="dash-plan-badge">
                              {subscription!.plan} Plan
                            </span>
                          </div>
                          <div className="dash-usage-section">
                            <div className="dash-usage-item">
                              <div className="dash-usage-row">
                                <span className="dash-usage-label">Calls Used</span>
                                <span className="dash-usage-value">{formatNumber(subscription!.calls_used)} / {formatNumber(subscription!.max_calls_per_month)}</span>
                              </div>
                              <div className="dash-progress-track">
                                <div className="dash-progress-bar dash-progress-blue" style={{ width: `${callsPct}%` }} />
                              </div>
                            </div>
                            <div className="dash-usage-item">
                              <div className="dash-usage-row">
                                <span className="dash-usage-label">Minutes Used</span>
                                <span className="dash-usage-value">{formatNumber(Math.round(Number(subscription!.minutes_used)))} / {formatNumber(subscription!.max_minutes_per_month)}</span>
                              </div>
                              <div className="dash-progress-track">
                                <div className="dash-progress-bar dash-progress-purple" style={{ width: `${minsPct}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="dash-card-header">
                            <div className="dash-card-header-left">
                              <Sparkles className="w-4 h-4 text-blue-400" />
                              <h3 className="dash-card-title">No Active Plan</h3>
                            </div>
                          </div>
                          <p className="dash-no-plan-text">Contact admin to activate your subscription.</p>
                        </div>
                      )}
                      <button className="dash-upgrade-btn">
                        <Zap className="w-3.5 h-3.5" />
                        Upgrade Plan
                      </button>
                    </div>

                    {/* Volume Chart */}
                    <div className="dash-card dash-chart-card">
                      <div className="dash-card-header">
                        <h3 className="dash-card-title">Call Volume — {chartPeriodLabels[chartPeriod]}</h3>
                        <select
                          value={chartPeriod}
                          onChange={(event) => setChartPeriod(event.target.value as ChartPeriod)}
                          className="dash-chart-period"
                          aria-label="Call volume date range"
                        >
                          <option value="7d">Last 7 days</option>
                          <option value="1m">Last month</option>
                          <option value="6m">Last 6 months</option>
                          <option value="1y">Last year</option>
                        </select>
                        <div className="dash-chart-legend">
                          <div className="dash-legend-item">
                            <span className="dash-legend-dot bg-blue-500" />
                            <span>Completed</span>
                          </div>
                          <div className="dash-legend-item">
                            <span className="dash-legend-dot bg-red-400/60" />
                            <span>Failed</span>
                          </div>
                        </div>
                      </div>
                      <div className="dash-chart-grid">
                        {chartDays.length > 0 ? chartDays.map((d) => (
                          <div key={d.date} className="dash-chart-col">
                            <div className="dash-chart-bars">
                              <div className="dash-bar dash-bar-completed" style={{ height: `${Math.round((d.completed / (maxCompleted || 1)) * 100)}%` }} />
                              <div className="dash-bar dash-bar-failed" style={{ height: `${Math.round(((d.total - d.completed) / (maxFailed || 1)) * 100)}%` }} />
                            </div>
                            <span className="dash-chart-day">{dayLabel(d.date)}</span>
                          </div>
                        )) : (
                          <div className="dash-chart-empty">No data yet</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="dash-card dash-activity-card">
                    <div className="dash-card-header">
                      <h3 className="dash-card-title">Recent Activity</h3>
                      <button onClick={() => setActiveNav('calls')} className="dash-view-all-btn">
                        View all calls
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="dash-table-wrap">
                      {recentCalls.length > 0 ? (
                        <table className="dash-table">
                          <thead>
                            <tr>
                              <th>Phone Number</th>
                              <th>Time</th>
                              <th>Duration</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentCalls.map((call) => (
                              <tr key={call.id}>
                                <td className="dash-table-phone">{call.phone_number}</td>
                                <td className="dash-table-muted">{timeAgo(call.created_at)}</td>
                                <td className="dash-table-muted">{formatDuration(call.duration_seconds)}</td>
                                <td>
                                  <span className={`dash-status-badge ${getStatusBadge(call.status)}`}>
                                    {statusLabel(call.status)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="dash-empty-state">No calls yet. Dispatch a call to see activity here.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {activeNav === 'calls' && (
            <div className="dash-section">
              <CallDispatcher />
              <BulkDialer />
              <CallHistory />
            </div>
          )}

          {activeNav === 'transcripts' && (
            <div className="dash-section">
              <TranscriptHistory />
            </div>
          )}

          {activeNav === 'settings' && (
            <div className="dash-section">
              <UpgradePlan />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
