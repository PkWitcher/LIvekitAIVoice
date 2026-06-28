"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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
  outbound: number;
  inbound: number;
}

interface PreviousPeriod {
  total: number;
  completed: number;
  pickupRate: number;
}

export default function DashboardStats() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    completed: 0,
    noAnswer: 0,
    ringing: 0,
    avgDuration: 0,
    outbound: 0,
    inbound: 0,
    pickupRate: 0,
  });
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [previousPeriod, setPreviousPeriod] = useState<PreviousPeriod>({
    total: 0,
    completed: 0,
    pickupRate: 0,
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setDaily(data.daily || []);
        setPreviousPeriod(data.previousPeriod || { total: 0, completed: 0, pickupRate: 0 });
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const formatDuration = (s: number) => {
    if (!s) return "0s";
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "—";
    const pct = Math.round(((current - previous) / previous) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  };

  const isPositive = (current: number, previous: number) => {
    return current >= previous;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  };

  const chartData = daily.map((d) => ({
    ...d,
    name: formatDate(d.date),
  }));

  return (
    <div className="space-y-6">
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          label="Calls Made"
          value={stats.total.toString()}
          change={calcChange(stats.total, previousPeriod.total)}
          positive={isPositive(stats.total, previousPeriod.total)}
          color="blue"
        />
        <StatCard
          label="Completed"
          value={stats.completed.toString()}
          change={calcChange(stats.completed, previousPeriod.completed)}
          positive={isPositive(stats.completed, previousPeriod.completed)}
          color="green"
        />
        <StatCard
          label="Pickup Rate"
          value={`${stats.pickupRate}%`}
          change={calcChange(stats.pickupRate, previousPeriod.pickupRate)}
          positive={isPositive(stats.pickupRate, previousPeriod.pickupRate)}
          color="violet"
        />
        <StatCard
          label="Outbound Calls"
          value={stats.outbound.toString()}
          change=""
          positive={true}
          color="cyan"
        />
        <StatCard
          label="Inbound Calls"
          value={stats.inbound.toString()}
          change=""
          positive={true}
          color="amber"
        />
        <StatCard
          label="Avg Duration"
          value={formatDuration(stats.avgDuration)}
          change=""
          positive={true}
          color="rose"
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Usage Overview */}
        <div className="glass-card p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Usage Overview</h3>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={{ stroke: "#1f2937" }}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={{ stroke: "#1f2937" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #1f2937",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total Calls"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorCompleted)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                No call data yet
              </div>
            )}
          </div>
        </div>

        {/* Inbound & Outbound */}
        <div className="glass-card p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Inbound & Outbound Calls</h3>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={{ stroke: "#1f2937" }}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={{ stroke: "#1f2937" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111827",
                      border: "1px solid #1f2937",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
                  <Bar dataKey="outbound" name="Outbound" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="inbound" name="Inbound" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                No call data yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  positive,
  color,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  color: string;
}) {
  const colorMap: Record<string, { text: string }> = {
    blue: { text: "text-blue-400" },
    green: { text: "text-green-400" },
    violet: { text: "text-violet-400" },
    cyan: { text: "text-cyan-400" },
    amber: { text: "text-amber-400" },
    rose: { text: "text-rose-400" },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="stat-card">
      <span className="text-[10px] sm:text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
        {label}
      </span>
      <div className={`text-xl sm:text-2xl font-bold mt-1 ${c.text}`}>{value}</div>
      {change && (
        <div className={`text-[10px] sm:text-xs mt-1 font-medium ${positive ? "text-green-400" : "text-red-400"}`}>
          {change}
          <span className="text-[var(--color-text-muted)] ml-1">vs prev period</span>
        </div>
      )}
    </div>
  );
}
