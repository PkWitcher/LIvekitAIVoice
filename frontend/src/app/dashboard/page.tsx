"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CallHistory from '@/components/CallHistory';
import CallDispatcher from '@/components/CallDispatcher';
import BulkDialer from '@/components/BulkDialer';
import TranscriptHistory from '@/components/TranscriptHistory';
import UpgradePlan, { UsageBar, summarizeSubscription, formatDateShort } from '@/components/UpgradePlan';
import type { SubscriptionInfo } from '@/components/UpgradePlan';
import AnalyticsAssistant from '@/components/AnalyticsAssistant';
import AgentBuilder from '@/components/AgentBuilder';
import AnalyticsBreakdown from '@/components/AnalyticsBreakdown';
import DashboardDateFilter from '@/components/DashboardDateFilter';
import ApiKeysManager from '@/components/ApiKeysManager';
import WebhooksManager from '@/components/WebhooksManager';
import '@/styles/dashboard-home.css';
import {
  Phone,
  CheckCircle2,
  XCircle,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  TrendingUp,
  LayoutDashboard,
  FileText,
  Settings,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  LogOut,
  Sparkles,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Bot,
  Webhook,
  Menu,
  X,
  Inbox,
  RefreshCw,
  CircleAlert,
  CalendarClock,
  ChartColumn,
  Mail,
  User,
  Activity,
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
  minutesUsed: number;
  conversionRate: number;
}

interface AgentBreakdownRow {
  agent_id: string;
  agent_name: string;
  total: number;
  completed: number;
  pickupRate: number;
  avgDuration: number;
}

interface CampaignBreakdownRow {
  campaign_id: string;
  started_at: string;
  total: number;
  completed: number;
  pickupRate: number;
}

interface CostAnalytics {
  ratePerMinute: number;
  totalCost: number;
  byAgent: { agent_id: string; agent_name: string; cost: number }[];
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
  "7d": "Last 7 days",
  "1m": "Last month",
  "6m": "Last 6 months",
  "1y": "Last year",
};

// Mirrors the server's PERIOD_DAYS in /api/stats so the "previous period" wording is exact
const PRESET_DAYS: Record<ChartPeriod, number> = { "7d": 7, "1m": 30, "6m": 180, "1y": 365 };
const DAY_MS = 86_400_000;
const MONTHLY_AGGREGATION_DAYS = 92;
const SUB_COLUMNS = 'plan, status, max_calls_per_month, calls_used, max_minutes_per_month, minutes_used, started_at, expires_at';

interface CallLog {
  id: string;
  phone_number: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
  direction?: string | null;
  contact_name?: string | null;
}

type NavId = 'dashboard' | 'calls' | 'agents' | 'integrations' | 'transcripts' | 'settings';

const NAV_ITEMS: { id: NavId; label: string; desc: string; icon: typeof Phone }[] = [
  { id: 'dashboard', label: 'Dashboard', desc: 'Overview of your call activity', icon: LayoutDashboard },
  { id: 'calls', label: 'Calls', desc: 'Manage and dispatch calls', icon: Phone },
  { id: 'agents', label: 'Agents', desc: 'Build and manage your AI call agents', icon: Bot },
  { id: 'integrations', label: 'Integrations', desc: 'API keys and outbound webhooks', icon: Webhook },
  { id: 'transcripts', label: 'Transcripts', desc: 'View call transcripts', icon: FileText },
  { id: 'settings', label: 'Settings', desc: 'Account, subscription and billing', icon: Settings },
];

// Default global date filter — current month to date, shown as pre-selected on load
function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const toIso = (d: Date) => d.toISOString().split("T")[0];
  return {
    from: toIso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
    to: toIso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))),
  };
}

// --- Pure helpers ---
const formatNumber = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('en-IN');

const formatCompact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n));

const ratio = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

const formatDuration = (s: number | null | undefined) => {
  if (!s || !Number.isFinite(s) || s <= 0) return '—';
  const total = Math.round(s);
  if (total >= 3600) return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`;
  const m = Math.floor(total / 60);
  return m > 0 ? `${m}m ${total % 60}s` : `${total}s`;
};

const timeAgo = (iso: string) => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 45) return 'Just now';
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const fullTimestamp = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const utcShort = (iso: string, withYear: boolean) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });

const inclusiveDays = (from: string, to: string) =>
  Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS) + 1;

const pluralDays = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

type StatusTone = 'good' | 'bad' | 'warn' | 'info' | 'live' | 'muted';
const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  completed: { label: 'Completed', tone: 'good' },
  failed: { label: 'Failed', tone: 'bad' },
  'no-answer': { label: 'No answer', tone: 'warn' },
  busy: { label: 'Busy', tone: 'warn' },
  ringing: { label: 'Ringing', tone: 'info' },
  initiated: { label: 'Initiated', tone: 'info' },
  connected: { label: 'In progress', tone: 'live' },
};

const statusMeta = (status: string) =>
  STATUS_META[status] ?? { label: status.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), tone: 'muted' as StatusTone };

interface Delta {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
  dir: 'up' | 'down' | 'flat';
  label: string;
}

// `invert` marks metrics where an increase is bad (e.g. failed calls)
function percentDelta(current: number, previous: number, invert = false): Delta | null {
  if (previous <= 0) return current > 0 ? { text: 'New', tone: 'neutral', dir: 'up', label: 'No activity in the previous period' } : null;
  const rounded = Math.round(((current - previous) / previous) * 100);
  if (rounded === 0) return { text: '0%', tone: 'neutral', dir: 'flat', label: 'Unchanged' };
  const up = rounded > 0;
  return {
    text: `${up ? '+' : '−'}${Math.abs(rounded)}%`,
    tone: up !== invert ? 'good' : 'bad',
    dir: up ? 'up' : 'down',
    label: `${up ? 'Up' : 'Down'} ${Math.abs(rounded)}%`,
  };
}

function pointDelta(current: number, previous: number): Delta | null {
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { text: '0 pts', tone: 'neutral', dir: 'flat', label: 'Unchanged' };
  const up = diff > 0;
  return {
    text: `${up ? '+' : '−'}${Math.abs(diff).toFixed(1)} pts`,
    tone: up ? 'good' : 'bad',
    dir: up ? 'up' : 'down',
    label: `${up ? 'Up' : 'Down'} ${Math.abs(diff).toFixed(1)} percentage points`,
  };
}

function niceScale(max: number) {
  const target = Math.max(max, 1);
  const rough = target / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = Math.max(1, Math.ceil([1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= rough) ?? pow * 10));
  return { top: step * 4, ticks: [0, 1, 2, 3, 4].map(i => i * step) };
}

interface ChartPoint {
  key: string;
  main: string;
  sub?: string;
  tooltip: string;
  total: number;
  completed: number;
  other: number;
}

function StatusPill({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span className={`dh2-pill dh2-pill-${meta.tone}`}>
      <span className="dh2-pill-dot" />
      {meta.label}
    </span>
  );
}

function DeltaChip({ delta, vs }: { delta: Delta | null; vs: string }) {
  if (!delta) return null;
  const Icon = delta.dir === 'up' ? ArrowUpRight : delta.dir === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={`dh2-delta dh2-delta-${delta.tone}`} title={`${delta.label} vs ${vs}`} aria-label={`${delta.label} versus ${vs}`}>
      <Icon size={12} aria-hidden="true" />
      {delta.text}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dh2-skeleton-page" aria-busy="true" aria-label="Loading dashboard">
      <div className="dh2-kpi-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="dh2-kpi">
            <div className="dh2-skel dh2-skel-line" style={{ width: '55%' }} />
            <div className="dh2-skel dh2-skel-value" />
            <div className="dh2-skel dh2-skel-line" style={{ width: '70%' }} />
          </div>
        ))}
      </div>
      <div className="dh2-row dh2-row-chart">
        <div className="dh2-panel"><div className="dh2-skel dh2-skel-chart" /></div>
        <div className="dh2-panel">
          <div className="dh2-skel dh2-skel-line" style={{ width: '45%' }} />
          <div className="dh2-skel dh2-skel-line" style={{ width: '100%', marginTop: 20 }} />
          <div className="dh2-skel dh2-skel-line" style={{ width: '100%', marginTop: 12 }} />
          <div className="dh2-skel dh2-skel-line" style={{ width: '80%', marginTop: 12 }} />
        </div>
      </div>
      <div className="dh2-panel">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="dh2-skel dh2-skel-line" style={{ width: '100%', marginTop: i ? 14 : 0 }} />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [activeNav, setActiveNav] = useState<NavId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("7d");
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(getCurrentMonthRange);
  const [chartLoading, setChartLoading] = useState(false);
  const [previousPeriod, setPreviousPeriod] = useState<PreviousPeriod>({ total: 0, completed: 0, pickupRate: 0 });
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [dispositionBreakdown, setDispositionBreakdown] = useState<Record<string, number>>({});
  const [agentBreakdown, setAgentBreakdown] = useState<AgentBreakdownRow[]>([]);
  const [campaignBreakdown, setCampaignBreakdown] = useState<CampaignBreakdownRow[]>([]);
  const [costAnalytics, setCostAnalytics] = useState<CostAnalytics>({ ratePerMinute: 0, totalCost: 0, byAgent: [] });
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [subLoaded, setSubLoaded] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const userIdRef = useRef<string | null>(null);
  const activeUrlRef = useRef('');
  const pendingPlansScroll = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const sidebarCloseRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const notifWrapRef = useRef<HTMLDivElement>(null);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const profileWrapRef = useRef<HTMLDivElement>(null);
  const profileBtnRef = useRef<HTMLButtonElement>(null);

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

  // Track the off-canvas breakpoint (mirrors the 1024px CSS media query)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const sync = () => {
      setIsMobile(mq.matches);
      if (!mq.matches) setSidebarOpen(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Fetch user info + subscription
  const loadSubscription = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    const { data } = await supabase
      .from('user_subscriptions')
      .select(SUB_COLUMNS)
      .eq('user_id', uid)
      .single();
    if (data) setSubscription(data as SubscriptionInfo);
    setSubLoaded(true);
  }, [supabase]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSubLoaded(true);
        return;
      }
      userIdRef.current = user.id;
      const email = user.email || '';
      const metadataName = typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name.trim()
        : '';
      setUserEmail(email);
      setMemberSince(user.created_at ?? null);

      const [{ data: profile }, { data: subscriptionData }] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', user.id)
          .single(),
        supabase
          .from('user_subscriptions')
          .select(SUB_COLUMNS)
          .eq('user_id', user.id)
          .single(),
      ]);

      setUserName(profile?.full_name?.trim() || metadataName || email.split('@')[0] || 'User');
      if (subscriptionData) setSubscription(subscriptionData as SubscriptionInfo);
      setSubLoaded(true);
    };
    fetchUser();
  }, [supabase]);

  // Keep usage counters fresh without a page reload
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) loadSubscription();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadSubscription]);

  // Fetch stats + calls
  const fetchData = useCallback(async () => {
    const statsUrl = customRange
      ? `/api/stats?from=${customRange.from}&to=${customRange.to}`
      : `/api/stats?period=${chartPeriod}`;
    activeUrlRef.current = statsUrl;
    try {
      const [statsRes, callsRes] = await Promise.all([
        fetch(statsUrl),
        fetch('/api/calls'),
      ]);
      const statsData = await statsRes.json();
      const callsData = await callsRes.json();
      // A newer range was selected while this request was in flight
      if (activeUrlRef.current !== statsUrl) return;

      if (statsData.success) {
        setStats(statsData.stats);
        setDaily(statsData.daily || []);
        setPreviousPeriod(statsData.previousPeriod || { total: 0, completed: 0, pickupRate: 0 });
        setDispositionBreakdown(statsData.dispositionBreakdown || {});
        setAgentBreakdown(statsData.agentBreakdown || []);
        setCampaignBreakdown(statsData.campaignBreakdown || []);
        setCostAnalytics(statsData.costAnalytics || { ratePerMinute: 0, totalCost: 0, byAgent: [] });
        setLoadError(null);
        setLastUpdated(new Date());
      } else {
        setLoadError(statsData.error || 'Unable to load dashboard data.');
      }
      if (callsData.success) {
        setCalls(callsData.calls || []);
      }
    } catch {
      if (activeUrlRef.current === statsUrl) setLoadError('Unable to reach the server. Retrying automatically…');
    } finally {
      if (activeUrlRef.current === statsUrl) {
        setLoading(false);
        setChartLoading(false);
      }
    }
  }, [chartPeriod, customRange]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (!document.hidden) fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Menus: click-outside + Escape (returns focus to the trigger)
  useEffect(() => {
    if (!notifOpen && !profileOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifOpen && !notifWrapRef.current?.contains(target)) setNotifOpen(false);
      if (profileOpen && !profileWrapRef.current?.contains(target)) setProfileOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (notifOpen) { setNotifOpen(false); notifBtnRef.current?.focus(); }
      if (profileOpen) { setProfileOpen(false); profileBtnRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [notifOpen, profileOpen]);

  // Off-canvas sidebar: focus the close button, close on Escape, keep Tab inside
  useEffect(() => {
    if (!sidebarOpen) return;
    sidebarCloseRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        hamburgerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || !sidebarRef.current) return;
      const focusable = sidebarRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  // Reset scroll when switching tabs (unless jumping to the plans section)
  useEffect(() => {
    if (activeNav === 'settings' && pendingPlansScroll.current) {
      pendingPlansScroll.current = false;
      document.getElementById('dh2-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeNav]);

  // --- Derived values ---
  const displayName = userName
    .trim()
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'User';
  const nameParts = displayName.split(/\s+/);
  const userInitials = nameParts.length > 1
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : displayName.slice(0, 2).toUpperCase();

  const total = stats?.total ?? 0;
  const completed = stats?.completed ?? 0;
  const noAnswer = stats?.noAnswer ?? 0;
  const inProgress = stats?.ringing ?? 0;
  // Everything that is not completed, no-answer or still in progress (failed, busy, initiated…)
  const failed = Math.max(total - completed - noAnswer - inProgress, 0);
  const successRate = ratio(completed, total);
  const prevSuccessRate = ratio(previousPeriod.completed, previousPeriod.total);

  // Period description (fixes "This month"/"last mo" wording when another range is selected)
  const rangeDays = customRange
    ? Math.min(366, Math.max(1, inclusiveDays(customRange.from, customRange.to)))
    : PRESET_DAYS[chartPeriod];
  const periodLabel = customRange
    ? (customRange.from === customRange.to
      ? utcShort(customRange.from, true)
      : `${utcShort(customRange.from, customRange.from.slice(0, 4) !== customRange.to.slice(0, 4))} – ${utcShort(customRange.to, true)}`)
    : chartPeriodLabels[chartPeriod];
  const prevLabel = `previous ${rangeDays === 1 ? 'day' : `${rangeDays} days`}`;

  // Period minutes: the stats API only returns an average, but cost = minutes × rate
  const periodMinutes = costAnalytics.ratePerMinute > 0
    ? costAnalytics.totalCost / costAnalytics.ratePerMinute
    : null;
  const minutesValue = periodMinutes !== null ? periodMinutes : (stats ? (stats.avgDuration * completed) / 60 : 0);
  const minutesText = minutesValue > 0 && minutesValue < 10 ? minutesValue.toFixed(1) : formatNumber(Math.round(minutesValue));

  const kpis = [
    {
      key: 'total', title: 'Total calls', value: formatNumber(total), icon: Phone, tone: 'violet',
      delta: percentDelta(total, previousPeriod.total),
      sub: previousPeriod.total > 0 ? `${formatNumber(previousPeriod.total)} in ${prevLabel}` : `No calls in ${prevLabel}`,
    },
    {
      key: 'completed', title: 'Completed', value: formatNumber(completed), icon: CheckCircle2, tone: 'green',
      delta: percentDelta(completed, previousPeriod.completed),
      sub: `${successRate.toFixed(1)}% of calls`,
    },
    {
      key: 'failed', title: 'Failed', value: formatNumber(failed), icon: XCircle, tone: 'red',
      delta: null as Delta | null,
      sub: `${ratio(failed, total).toFixed(1)}% of calls`,
    },
    {
      key: 'noanswer', title: 'No answer', value: formatNumber(noAnswer), icon: PhoneOff, tone: 'amber',
      delta: null as Delta | null,
      sub: `${ratio(noAnswer, total).toFixed(1)}% of calls`,
    },
    {
      key: 'minutes', title: 'Total minutes', value: minutesText, icon: Clock, tone: 'cyan',
      delta: null as Delta | null,
      sub: stats && stats.avgDuration > 0 ? `${formatDuration(stats.avgDuration)} avg per call` : 'No talk time yet',
    },
    {
      key: 'success', title: 'Success rate', value: `${successRate.toFixed(1)}%`, icon: TrendingUp, tone: 'blue',
      delta: total > 0 && previousPeriod.total > 0 ? pointDelta(successRate, prevSuccessRate) : null,
      sub: previousPeriod.total > 0 ? `${prevSuccessRate.toFixed(1)}% in ${prevLabel}` : 'Completed ÷ total calls',
    },
  ];

  // Chart series — daily bars, or monthly buckets for 6m / 1y / long custom ranges
  const monthly = customRange ? rangeDays > MONTHLY_AGGREGATION_DAYS : (chartPeriod === "6m" || chartPeriod === "1y");
  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (monthly) {
      const buckets = new Map<string, { total: number; completed: number; days: number }>();
      for (const day of daily) {
        const month = day.date.slice(0, 7);
        const bucket = buckets.get(month) ?? { total: 0, completed: 0, days: 0 };
        bucket.total += day.total;
        bucket.completed += day.completed;
        bucket.days += 1;
        buckets.set(month, bucket);
      }
      const years = new Set(Array.from(buckets.keys()).map(k => k.slice(0, 4)));
      return Array.from(buckets.entries()).map(([month, b]) => {
        const date = new Date(`${month}-01T00:00:00Z`);
        const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        const mon = date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
        return {
          key: month,
          main: mon,
          sub: years.size > 1 ? String(date.getUTCFullYear()) : undefined,
          tooltip: `${date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}${b.days < daysInMonth ? ' (partial)' : ''}`,
          total: b.total,
          completed: b.completed,
          other: Math.max(b.total - b.completed, 0),
        };
      });
    }
    return daily.map((d, i) => {
      const date = new Date(`${d.date}T00:00:00Z`);
      const dom = date.getUTCDate();
      const mon = date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
      return {
        key: d.date,
        main: daily.length <= 7 ? date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }) : String(dom),
        sub: daily.length > 7 && (i === 0 || dom === 1) ? mon : undefined,
        tooltip: date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
        total: d.total,
        completed: d.completed,
        other: Math.max(d.total - d.completed, 0),
      };
    });
  }, [daily, monthly]);

  const chartTotal = chartPoints.reduce((sum, p) => sum + p.total, 0);
  const chartCompleted = chartPoints.reduce((sum, p) => sum + p.completed, 0);
  const peakPoint = chartPoints.reduce<ChartPoint | null>((best, p) => (p.total > (best?.total ?? 0) ? p : best), null);
  const scale = niceScale(Math.max(...chartPoints.map(p => p.total), 0));
  const labelEvery = Math.max(1, Math.ceil(chartPoints.length / 10));

  // Subscription / usage
  const minutesUsedValue = stats ? stats.minutesUsed : (subscription?.minutes_used ?? 0);
  const subInfo: SubscriptionInfo | null = subscription ? { ...subscription, minutes_used: minutesUsedValue } : null;
  const sum = summarizeSubscription(subInfo);
  const needsPlanAction = subLoaded && (!sum.isLive || sum.peakTone === 'crit' || sum.expiringSoon);
  const planCtaLabel = !sum.hasRecord ? 'Choose a plan' : (sum.status === 'expired' || sum.status === 'cancelled' || sum.expiringSoon) ? 'Renew plan' : 'Upgrade plan';

  const activeCallsList = calls.filter(c => c.status === 'ringing' || c.status === 'connected');
  const activeCalls = activeCallsList.length;
  const planAlerts: { id: string; tone: 'warn' | 'crit'; title: string; detail: string }[] = [];
  if (subLoaded) {
    if (!sum.hasRecord) planAlerts.push({ id: 'noplan', tone: 'warn', title: 'No active plan', detail: 'Choose a plan to start placing calls.' });
    else if (sum.status === 'expired') planAlerts.push({ id: 'expired', tone: 'crit', title: 'Plan expired', detail: sum.renewalLabel });
    else if (sum.status === 'cancelled') planAlerts.push({ id: 'cancelled', tone: 'crit', title: 'Subscription cancelled', detail: 'Choose a plan to reactivate calling.' });
    else {
      if (sum.expiringSoon) planAlerts.push({ id: 'expiring', tone: sum.renewalTone === 'crit' ? 'crit' : 'warn', title: 'Plan ending soon', detail: sum.renewalLabel });
      if (sum.callTone !== 'ok') planAlerts.push({ id: 'calls', tone: sum.callTone, title: `${sum.callPct}% of calls used`, detail: `${formatNumber(sum.callsUsed)} of ${formatNumber(sum.callsMax)} calls this period.` });
      if (sum.minuteTone !== 'ok') planAlerts.push({ id: 'minutes', tone: sum.minuteTone, title: `${sum.minutePct}% of minutes used`, detail: `${formatNumber(Math.round(sum.minutesUsed))} of ${formatNumber(sum.minutesMax)} minutes this period.` });
    }
  }
  const notifCount = activeCalls + planAlerts.length;

  const recentCalls = calls.slice(0, 6);
  const activeItem = NAV_ITEMS.find(n => n.id === activeNav) ?? NAV_ITEMS[0];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const closeSidebar = (returnFocus = false) => {
    setSidebarOpen(false);
    if (returnFocus) hamburgerRef.current?.focus();
  };

  const handleNavClick = (nav: NavId) => {
    setActiveNav(nav);
    setSidebarOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
  };

  const goToPlans = () => {
    setSidebarOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
    if (activeNav === 'settings') {
      document.getElementById('dh2-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    pendingPlansScroll.current = true;
    setActiveNav('settings');
  };

  const refreshAfterPayment = () => {
    loadSubscription();
    fetchData();
  };

  const retryFetch = () => {
    setLoadError(null);
    fetchData();
  };

  const sidebarHidden = isMobile && !sidebarOpen;

  return (
    <div data-dashboard className="dash-root dh2">
      <a href="#dh2-main" className="dh2-skip">Skip to main content</a>

      {/* Background Effects */}
      <div className="dash-bg-effects">
        <div className="dash-glow dash-glow-1" />
        <div className="dash-glow dash-glow-2" />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="dh2-overlay" onClick={() => closeSidebar()} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`dh2-sidebar ${sidebarOpen ? 'open' : ''}`}
        aria-label="Primary"
        inert={sidebarHidden}
      >
        <div className="dh2-sidebar-top">
          <div className="dh2-brand-row">
            <Link href="/" className="dh2-brand" aria-label="Nova AI home">
              <div className="dh2-brand-icon">
                <Phone size={18} aria-hidden="true" />
              </div>
              <div>
                <span className="dh2-brand-title">Nova AI</span>
                <span className="dh2-brand-sub">Voice Platform</span>
              </div>
            </Link>
            <button
              ref={sidebarCloseRef}
              className="dh2-sidebar-close"
              onClick={() => closeSidebar(true)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="dh2-nav" aria-label="Dashboard sections">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                className={`dh2-nav-item ${activeNav === id ? 'active' : ''}`}
                aria-current={activeNav === id ? 'page' : undefined}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
                {id === 'calls' && activeCalls > 0 && (
                  <span className="dh2-nav-badge" aria-label={`${activeCalls} active calls`}>
                    <span className="dh2-live-dot" aria-hidden="true" />{activeCalls}
                  </span>
                )}
                {id === 'settings' && needsPlanAction && (
                  <span className="dh2-nav-badge dh2-nav-badge-warn" aria-label="Plan needs attention">!</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="dh2-sidebar-bottom">
          {!subLoaded ? (
            <div className="dh2-plan-mini" aria-busy="true">
              <div className="dh2-skel dh2-skel-line" style={{ width: '50%' }} />
              <div className="dh2-skel dh2-skel-line" style={{ width: '100%', marginTop: 12 }} />
              <div className="dh2-skel dh2-skel-line" style={{ width: '100%', marginTop: 10 }} />
            </div>
          ) : (
            <div className="dh2-plan-mini">
              <div className="dh2-plan-mini-head">
                <span className="dh2-plan-mini-name">
                  <Sparkles size={13} aria-hidden="true" />
                  {sum.hasRecord ? `${sum.planLabel} plan` : 'No plan'}
                </span>
                {sum.hasRecord && (
                  <span className={`dh2-pill dh2-pill-sm dh2-status-${sum.status}`}>
                    <span className="dh2-pill-dot" />{sum.status}
                  </span>
                )}
              </div>
              {sum.hasRecord ? (
                <>
                  <div className="dh2-mini-usage">
                    <div className="dh2-mini-usage-top"><span>Calls</span><span>{formatNumber(sum.callsUsed)} / {formatNumber(sum.callsMax)}</span></div>
                    <div className="dh2-bar dh2-bar-thin" role="progressbar" aria-label="Calls used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={sum.callPct}>
                      <div className={`dh2-bar-fill dh2-bar-${sum.callTone}`} style={{ width: `${sum.callPct}%` }} />
                    </div>
                  </div>
                  <div className="dh2-mini-usage">
                    <div className="dh2-mini-usage-top"><span>Minutes</span><span>{formatNumber(Math.round(sum.minutesUsed))} / {formatNumber(sum.minutesMax)}</span></div>
                    <div className="dh2-bar dh2-bar-thin" role="progressbar" aria-label="Minutes used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={sum.minutePct}>
                      <div className={`dh2-bar-fill dh2-bar-${sum.minuteTone}`} style={{ width: `${sum.minutePct}%` }} />
                    </div>
                  </div>
                  <p className={`dh2-plan-mini-renew ${sum.renewalTone}`}>{sum.renewalLabel}</p>
                </>
              ) : (
                <p className="dh2-plan-mini-text">Subscribe to start placing AI calls.</p>
              )}
              {needsPlanAction ? (
                <button className="dh2-btn dh2-btn-primary dh2-btn-block dh2-btn-sm" onClick={goToPlans}>
                  <Zap size={13} aria-hidden="true" />
                  {planCtaLabel}
                </button>
              ) : (
                <button className="dh2-link-btn" onClick={goToPlans}>
                  Manage plan <ArrowUpRight size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="dh2-main">
        {/* Header */}
        <header className="dh2-header">
          <div className="dh2-header-left">
            <button
              ref={hamburgerRef}
              className="dh2-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
            >
              <Menu size={20} />
            </button>
            <div className="dh2-header-titles">
              <h2 className="dh2-title">{activeItem.label}</h2>
              <p className="dh2-subtitle">
                <span className="dh2-crumb">Nova AI</span>
                <ChevronRight size={11} aria-hidden="true" className="dh2-crumb-sep" />
                <span>{activeItem.desc}</span>
              </p>
            </div>
          </div>
          <div className="dh2-header-actions">
            {activeNav === 'dashboard' && (
              <DashboardDateFilter
                from={customRange?.from ?? null}
                to={customRange?.to ?? null}
                onApply={(from, to) => { setChartLoading(true); setCustomRange({ from, to }); }}
                onClear={() => { setChartLoading(true); setCustomRange(null); }}
              />
            )}
            <div className="dh2-menu-wrap" ref={notifWrapRef}>
              <button
                ref={notifBtnRef}
                className="dh2-icon-btn dh2-notif-btn"
                onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
                aria-label={notifCount > 0 ? `Notifications, ${notifCount} need attention` : 'Notifications'}
                aria-haspopup="dialog"
                aria-expanded={notifOpen}
              >
                <Bell size={16} aria-hidden="true" />
                {notifCount > 0 && <span className="dh2-notif-dot">{notifCount > 9 ? '9+' : notifCount}</span>}
              </button>

              {notifOpen && (
                <div className="dh2-dropdown dh2-notif-dropdown" role="dialog" aria-label="Notifications">
                  {planAlerts.length > 0 && (
                    <>
                      <p className="dh2-dropdown-title">Plan alerts</p>
                      {planAlerts.map(alert => (
                        <button key={alert.id} className="dh2-notif-alert" onClick={goToPlans}>
                          <CircleAlert size={14} className={`dh2-tone-${alert.tone}`} aria-hidden="true" />
                          <span>
                            <strong>{alert.title}</strong>
                            <small>{alert.detail}</small>
                          </span>
                        </button>
                      ))}
                      <div className="dh2-divider" />
                    </>
                  )}
                  <p className="dh2-dropdown-title">Active calls</p>
                  {activeCallsList.length > 0 ? (
                    activeCallsList.slice(0, 8).map((call) => (
                      <div key={call.id} className="dh2-notif-item">
                        <span className="dh2-mono">{call.phone_number}</span>
                        <StatusPill status={call.status} />
                      </div>
                    ))
                  ) : (
                    <p className="dh2-dropdown-empty">No active calls right now.</p>
                  )}
                  <button
                    onClick={() => { handleNavClick('calls'); }}
                    className="dh2-btn dh2-btn-secondary dh2-btn-sm dh2-btn-block"
                  >
                    View all calls
                    <ArrowUpRight size={12} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            <div className="dh2-menu-wrap" ref={profileWrapRef}>
              <button
                ref={profileBtnRef}
                onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                className="dh2-profile-btn"
                aria-label={`Open profile menu for ${displayName}`}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
              >
                <span className="dh2-avatar dh2-avatar-sm" aria-hidden="true">{userInitials}</span>
                <ChevronDown size={13} className={`dh2-chevron ${profileOpen ? 'open' : ''}`} aria-hidden="true" />
              </button>

              {profileOpen && (
                <div className="dh2-dropdown dh2-profile-dropdown" role="menu" aria-label="Profile">
                  <div className="dh2-profile-info">
                    <span className="dh2-avatar" aria-hidden="true">{userInitials}</span>
                    <div>
                      <p className="dh2-profile-name">{displayName}</p>
                      {userEmail && <p className="dh2-profile-email" title={userEmail}>{userEmail}</p>}
                      <p className="dh2-profile-plan">{sum.isLive ? `${sum.planLabel} plan` : 'No plan'}</p>
                    </div>
                  </div>
                  <div className="dh2-divider" />
                  <button role="menuitem" onClick={() => handleNavClick('settings')} className="dh2-menu-item">
                    <Settings size={14} aria-hidden="true" />
                    <span>Settings &amp; billing</span>
                  </button>
                  <button role="menuitem" onClick={toggleTheme} className="dh2-menu-item">
                    {theme === 'dark' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
                    <span>{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
                  </button>
                  <button role="menuitem" onClick={handleLogout} className="dh2-menu-item dh2-menu-item-danger">
                    <LogOut size={14} aria-hidden="true" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dash-content dh2-content" id="dh2-main" ref={contentRef} tabIndex={-1}>
          {activeNav === 'dashboard' && (
            <div className="dh2-home">
              {loading ? (
                <DashboardSkeleton />
              ) : (
                <>
                  <div className="dh2-section-head">
                    <div>
                      <h3 className="dh2-section-title">Overview</h3>
                      <p className="dh2-section-sub">
                        {periodLabel}
                        <span className="dh2-dot-sep" aria-hidden="true">·</span>
                        compared with the {prevLabel}
                      </p>
                    </div>
                    <div className="dh2-live">
                      {lastUpdated && (
                        <span className="dh2-live-text">
                          <span className="dh2-live-dot" aria-hidden="true" />
                          Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      )}
                      <button className="dh2-icon-btn" onClick={fetchData} aria-label="Refresh dashboard data" title="Refresh">
                        <RefreshCw size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {loadError && (
                    <div className="dh2-notice dh2-notice-error" role="alert">
                      <CircleAlert size={16} aria-hidden="true" />
                      <div>
                        <strong>Couldn&apos;t refresh your data</strong>
                        <p>{loadError}{stats ? ' Showing the last loaded figures.' : ''}</p>
                      </div>
                      <button className="dh2-btn dh2-btn-secondary dh2-btn-sm" onClick={retryFetch}>Retry</button>
                    </div>
                  )}

                  {/* KPI cards */}
                  <div className="dh2-kpi-grid">
                    {kpis.map((m) => {
                      const Icon = m.icon;
                      return (
                        <article key={m.key} className={`dh2-kpi dh2-kpi-${m.tone}`} aria-label={m.title}>
                          <div className="dh2-kpi-top">
                            <span className="dh2-kpi-label">{m.title}</span>
                            <span className="dh2-kpi-icon"><Icon size={15} aria-hidden="true" /></span>
                          </div>
                          <div className="dh2-kpi-value">{m.value}</div>
                          <div className="dh2-kpi-foot">
                            <DeltaChip delta={m.delta} vs={prevLabel} />
                            <span className="dh2-kpi-sub">{m.sub}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* Chart + plan usage */}
                  <div className="dh2-row dh2-row-chart">
                    <section className="dh2-panel dh2-chart-card" aria-labelledby="dh2-chart-title">
                      <header className="dh2-panel-head">
                        <div>
                          <h3 id="dh2-chart-title" className="dh2-panel-title">Call volume</h3>
                          <p className="dh2-panel-sub">{periodLabel}{monthly ? ' · by month' : ' · by day'}</p>
                        </div>
                        <div className="dh2-chart-controls">
                          {!customRange && (
                            <select
                              value={chartPeriod}
                              onChange={(event) => {
                                setChartLoading(true);
                                setChartPeriod(event.target.value as ChartPeriod);
                              }}
                              className="dh2-select"
                              aria-label="Call volume date range"
                            >
                              <option value="7d">Last 7 days</option>
                              <option value="1m">Last month</option>
                              <option value="6m">Last 6 months</option>
                              <option value="1y">Last year</option>
                            </select>
                          )}
                          <ul className="dh2-legend" aria-label="Chart legend">
                            <li><span className="dh2-legend-dot dh2-seg-completed" />Completed</li>
                            <li><span className="dh2-legend-dot dh2-seg-other" />Not completed</li>
                          </ul>
                        </div>
                      </header>

                      <div className="dh2-chart-stats">
                        <div><span>Total calls</span><strong>{formatNumber(chartTotal)}</strong></div>
                        <div><span>Completed</span><strong>{formatNumber(chartCompleted)}<small>{chartTotal > 0 ? ` · ${ratio(chartCompleted, chartTotal).toFixed(0)}%` : ''}</small></strong></div>
                        <div><span>Busiest {monthly ? 'month' : 'day'}</span><strong>{peakPoint ? <>{peakPoint.tooltip.replace(' (partial)', '')}<small> · {formatNumber(peakPoint.total)}</small></> : '—'}</strong></div>
                      </div>

                      <div className={`dh2-chart ${chartLoading ? 'is-loading' : ''}`} aria-busy={chartLoading}>
                        <div className="dh2-chart-y" aria-hidden="true">
                          {[...scale.ticks].reverse().map((t) => <span key={t}>{formatCompact(t)}</span>)}
                        </div>
                        <div className="dh2-chart-plot">
                          <div className="dh2-chart-gridlines" aria-hidden="true">
                            {scale.ticks.map((t, i) => <i key={t} style={{ bottom: `${(i / 4) * 100}%` }} />)}
                          </div>
                          <div
                            className="dh2-chart-cols"
                            style={{ gridTemplateColumns: `repeat(${Math.max(chartPoints.length, 1)}, minmax(0, 1fr))` }}
                            role="group"
                            aria-label={`Call volume ${periodLabel}: ${formatNumber(chartTotal)} calls, ${formatNumber(chartCompleted)} completed`}
                          >
                            {chartPoints.map((p, i) => {
                              const align = i < chartPoints.length * 0.2 ? 'start' : i > chartPoints.length * 0.8 ? 'end' : 'mid';
                              return (
                                <div
                                  key={p.key}
                                  className="dh2-col"
                                  tabIndex={chartPoints.length <= 31 ? 0 : -1}
                                  data-align={align}
                                  role="group"
                                  aria-label={`${p.tooltip}: ${p.total} calls, ${p.completed} completed`}
                                >
                                  <div className="dh2-tooltip" role="tooltip">
                                    <strong>{p.tooltip}</strong>
                                    <span><i className="dh2-seg-completed" />Completed <b>{formatNumber(p.completed)}</b></span>
                                    <span><i className="dh2-seg-other" />Not completed <b>{formatNumber(p.other)}</b></span>
                                    <span className="dh2-tooltip-total">Total <b>{formatNumber(p.total)}</b></span>
                                  </div>
                                  <div className="dh2-stack" style={{ height: `${Math.min(100, (p.total / scale.top) * 100)}%` }}>
                                    {p.other > 0 && <div className="dh2-seg dh2-seg-other" style={{ flexGrow: p.other }} />}
                                    {p.completed > 0 && <div className="dh2-seg dh2-seg-completed" style={{ flexGrow: p.completed }} />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div
                            className="dh2-chart-x"
                            style={{ gridTemplateColumns: `repeat(${Math.max(chartPoints.length, 1)}, minmax(0, 1fr))` }}
                            aria-hidden="true"
                          >
                            {chartPoints.map((p, i) => (
                              <span key={p.key} className={i % labelEvery === 0 ? '' : 'skip'}>
                                {p.main}
                                {p.sub && <small>{p.sub}</small>}
                              </span>
                            ))}
                          </div>
                          {chartTotal === 0 && !chartLoading && (
                            <div className="dh2-chart-empty">
                              <span className="dh2-empty-icon"><ChartColumn size={20} aria-hidden="true" /></span>
                              <strong>No calls in this period</strong>
                              <p>Try a wider date range, or dispatch a call to see volume here.</p>
                              <button className="dh2-btn dh2-btn-secondary dh2-btn-sm" onClick={() => handleNavClick('calls')}>
                                <Phone size={13} aria-hidden="true" /> Go to Calls
                              </button>
                            </div>
                          )}
                          {chartLoading && (
                            <div className="dh2-chart-loading" role="status">
                              <span className="dh2-spinner" aria-hidden="true" /> Updating…
                            </div>
                          )}
                        </div>
                        <table className="dh2-sr-only">
                          <caption>Call volume {periodLabel}</caption>
                          <thead><tr><th>Period</th><th>Completed</th><th>Not completed</th><th>Total</th></tr></thead>
                          <tbody>
                            {chartPoints.map((p) => (
                              <tr key={p.key}><td>{p.tooltip}</td><td>{p.completed}</td><td>{p.other}</td><td>{p.total}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className="dh2-panel dh2-plan-panel" aria-labelledby="dh2-plan-title">
                      <header className="dh2-panel-head">
                        <h3 id="dh2-plan-title" className="dh2-panel-title">
                          <Sparkles size={16} aria-hidden="true" className="dh2-ico-violet" /> Plan usage
                        </h3>
                        {sum.hasRecord && <span className={`dh2-pill dh2-plan-${sum.plan}`}>{sum.planLabel}</span>}
                      </header>
                      {!subLoaded ? (
                        <div aria-busy="true">
                          <div className="dh2-skel dh2-skel-line" style={{ width: '100%' }} />
                          <div className="dh2-skel dh2-skel-line" style={{ width: '100%', marginTop: 14 }} />
                        </div>
                      ) : sum.hasRecord ? (
                        <>
                          <div className="dh2-plan-status">
                            <span className={`dh2-pill dh2-status-${sum.status}`}><span className="dh2-pill-dot" />{sum.status}</span>
                            <span className="dh2-plan-renew">
                              <CalendarClock size={13} aria-hidden="true" />
                              <span className={sum.renewalTone}>{sum.renewalLabel}</span>
                              {sum.expiresAt && <small>· {sum.status === 'expired' ? 'ended' : 'ends'} {formatDateShort(sum.expiresAt)}</small>}
                            </span>
                          </div>
                          <div className="dh2-usage-stack">
                            <UsageBar label="Calls used" used={sum.callsUsed} max={sum.callsMax} pct={sum.callPct} tone={sum.callTone} />
                            <UsageBar label="Minutes used" used={Math.round(sum.minutesUsed)} max={sum.minutesMax} pct={sum.minutePct} tone={sum.minuteTone} />
                          </div>
                          <p className="dh2-muted-note">Bars turn amber at 70% and red at 90% of your allowance.</p>
                        </>
                      ) : (
                        <div className="dh2-empty dh2-empty-compact">
                          <span className="dh2-empty-icon"><Zap size={18} aria-hidden="true" /></span>
                          <p className="dh2-empty-title">No active plan</p>
                          <p className="dh2-empty-text">Subscribe to start placing AI calls.</p>
                        </div>
                      )}
                      <button className="dh2-btn dh2-btn-primary dh2-btn-block" onClick={goToPlans}>
                        <Zap size={14} aria-hidden="true" />
                        {needsPlanAction ? planCtaLabel : 'Manage plan'}
                      </button>
                    </section>
                  </div>

                  {/* Outcomes + recent activity */}
                  <div className="dh2-row dh2-row-activity">
                    <section className="dh2-panel" aria-labelledby="dh2-outcome-title">
                      <header className="dh2-panel-head">
                        <h3 id="dh2-outcome-title" className="dh2-panel-title">
                          <Activity size={16} aria-hidden="true" className="dh2-ico-blue" /> Call outcomes
                        </h3>
                      </header>
                      {total === 0 ? (
                        <div className="dh2-empty dh2-empty-compact">
                          <p className="dh2-empty-title">No calls in this period</p>
                          <p className="dh2-empty-text">Outcomes will appear once calls are placed.</p>
                        </div>
                      ) : (
                        <>
                          <div className="dh2-outcome-bar" role="img" aria-label={`Completed ${completed}, failed ${failed}, no answer ${noAnswer}, in progress ${inProgress}`}>
                            {completed > 0 && <span className="dh2-oc-good" style={{ flexGrow: completed }} />}
                            {failed > 0 && <span className="dh2-oc-bad" style={{ flexGrow: failed }} />}
                            {noAnswer > 0 && <span className="dh2-oc-warn" style={{ flexGrow: noAnswer }} />}
                            {inProgress > 0 && <span className="dh2-oc-info" style={{ flexGrow: inProgress }} />}
                          </div>
                          <ul className="dh2-outcome-list">
                            {[
                              { label: 'Completed', value: completed, cls: 'dh2-oc-good' },
                              { label: 'Failed', value: failed, cls: 'dh2-oc-bad' },
                              { label: 'No answer', value: noAnswer, cls: 'dh2-oc-warn' },
                              { label: 'In progress', value: inProgress, cls: 'dh2-oc-info' },
                            ].map(o => (
                              <li key={o.label}>
                                <span className="dh2-outcome-name"><i className={o.cls} aria-hidden="true" />{o.label}</span>
                                <span className="dh2-outcome-val">{formatNumber(o.value)}</span>
                                <span className="dh2-outcome-pct">{ratio(o.value, total).toFixed(1)}%</span>
                              </li>
                            ))}
                          </ul>
                          <dl className="dh2-facts">
                            <div><dt><PhoneOutgoing size={13} aria-hidden="true" /> Outbound</dt><dd>{formatNumber(stats?.outbound ?? 0)}</dd></div>
                            <div><dt><PhoneIncoming size={13} aria-hidden="true" /> Inbound</dt><dd>{formatNumber(stats?.inbound ?? 0)}</dd></div>
                            <div><dt><Clock size={13} aria-hidden="true" /> Avg duration</dt><dd>{formatDuration(stats?.avgDuration)}</dd></div>
                          </dl>
                        </>
                      )}
                    </section>

                    <section className="dh2-panel" aria-labelledby="dh2-recent-title">
                      <header className="dh2-panel-head">
                        <h3 id="dh2-recent-title" className="dh2-panel-title">Recent activity</h3>
                        <button onClick={() => handleNavClick('calls')} className="dh2-link-btn">
                          View all calls
                          <ArrowUpRight size={12} aria-hidden="true" />
                        </button>
                      </header>
                      {recentCalls.length > 0 ? (
                        <div className="dh2-table-scroll">
                          <table className="dh2-table">
                            <thead>
                              <tr>
                                <th scope="col">Contact</th>
                                <th scope="col">Time</th>
                                <th scope="col" className="num dh2-hide-sm">Duration</th>
                                <th scope="col">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recentCalls.map((call) => (
                                <tr key={call.id}>
                                  <td>
                                    <div className="dh2-contact">
                                      <span className="dh2-contact-ico" title={call.direction === 'inbound' ? 'Inbound call' : 'Outbound call'}>
                                        {call.direction === 'inbound' ? <PhoneIncoming size={13} aria-label="Inbound" /> : <PhoneOutgoing size={13} aria-label="Outbound" />}
                                      </span>
                                      <span>
                                        {call.contact_name && <span className="dh2-contact-name">{call.contact_name}</span>}
                                        <span className="dh2-mono">{call.phone_number}</span>
                                      </span>
                                    </div>
                                  </td>
                                  <td className="muted" title={fullTimestamp(call.created_at)}>{timeAgo(call.created_at)}</td>
                                  <td className="num muted dh2-hide-sm">{formatDuration(call.duration_seconds)}</td>
                                  <td><StatusPill status={call.status} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="dh2-empty">
                          <span className="dh2-empty-icon"><Inbox size={20} aria-hidden="true" /></span>
                          <p className="dh2-empty-title">No calls yet</p>
                          <p className="dh2-empty-text">Dispatch your first call to see activity here.</p>
                          <button className="dh2-btn dh2-btn-primary dh2-btn-sm" onClick={() => handleNavClick('calls')}>
                            <Phone size={13} aria-hidden="true" /> Dispatch a call
                          </button>
                        </div>
                      )}
                    </section>
                  </div>

                  <AnalyticsBreakdown
                    conversionRate={stats?.conversionRate ?? 0}
                    dispositionBreakdown={dispositionBreakdown}
                    agentBreakdown={agentBreakdown}
                    campaignBreakdown={campaignBreakdown}
                    costAnalytics={costAnalytics}
                  />
                </>
              )}
            </div>
          )}

          {activeNav === 'calls' && (
            <div className="dash-section">
              <CallDispatcher />
              <BulkDialer />
              <CallHistory />
            </div>
          )}

          {activeNav === 'agents' && (
            <div className="dash-section">
              <AgentBuilder />
            </div>
          )}

          {activeNav === 'integrations' && (
            <div className="dash-section">
              <ApiKeysManager />
              <WebhooksManager />
            </div>
          )}

          {activeNav === 'transcripts' && (
            <div className="dash-section">
              <TranscriptHistory />
            </div>
          )}

          {activeNav === 'settings' && (
            <div className="dash-section dh2-settings">
              <section className="dh2-panel" aria-labelledby="dh2-account-title">
                <header className="dh2-panel-head">
                  <div>
                    <h3 id="dh2-account-title" className="dh2-section-title">Account</h3>
                    <p className="dh2-section-sub">Your profile details. Contact your administrator to change them.</p>
                  </div>
                  <span className="dh2-avatar dh2-avatar-lg" aria-hidden="true">{userInitials}</span>
                </header>
                <dl className="dh2-account-grid">
                  <div>
                    <dt><User size={13} aria-hidden="true" /> Full name</dt>
                    <dd>{userName ? displayName : '—'}</dd>
                  </div>
                  <div>
                    <dt><Mail size={13} aria-hidden="true" /> Email</dt>
                    <dd title={userEmail}>{userEmail || '—'}</dd>
                  </div>
                  <div>
                    <dt><CalendarClock size={13} aria-hidden="true" /> Member since</dt>
                    <dd>{formatDateShort(memberSince)}</dd>
                  </div>
                </dl>
              </section>
              <UpgradePlan
                subscription={subInfo}
                subscriptionLoading={!subLoaded}
                onSuccess={refreshAfterPayment}
              />
            </div>
          )}
        </div>
      </main>
      <AnalyticsAssistant />
    </div>
  );
}
