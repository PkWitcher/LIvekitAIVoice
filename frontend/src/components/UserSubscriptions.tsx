"use client";

import { useEffect, useState, useCallback } from "react";

interface Subscription {
  id: string;
  user_id: string;
  email: string;
  plan: string;
  status: string;
  max_calls_per_month: number;
  calls_used: number;
  max_minutes_per_month: number;
  minutes_used: number;
  amount_cents: number;
  currency: string;
  started_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
}

interface UserOption {
  user_id: string;
  email: string;
}

const PLAN_LIMITS: Record<string, { calls: number; minutes: number; amount: number }> = {
  free: { calls: 50, minutes: 100, amount: 0 },
  basic: { calls: 200, minutes: 500, amount: 999 },
  pro: { calls: 1000, minutes: 2000, amount: 2999 },
  enterprise: { calls: 10000, minutes: 20000, amount: 9999 },
};

export default function UserSubscriptions({ users }: { users: UserOption[] }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formUserId, setFormUserId] = useState("");
  const [formPlan, setFormPlan] = useState("free");
  const [formStatus, setFormStatus] = useState("active");
  const [formMaxCalls, setFormMaxCalls] = useState(50);
  const [formMaxMinutes, setFormMaxMinutes] = useState(100);
  const [formAmount, setFormAmount] = useState(0);
  const [formExpires, setFormExpires] = useState("");

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/subscriptions");
      const data = await res.json();
      if (data.success) {
        setSubscriptions(data.subscriptions);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const openAddModal = () => {
    setEditingSub(null);
    setFormUserId("");
    setFormPlan("free");
    setFormStatus("active");
    setFormMaxCalls(50);
    setFormMaxMinutes(100);
    setFormAmount(0);
    setFormExpires("");
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (sub: Subscription) => {
    setEditingSub(sub);
    setFormUserId(sub.user_id);
    setFormPlan(sub.plan);
    setFormStatus(sub.status);
    setFormMaxCalls(sub.max_calls_per_month);
    setFormMaxMinutes(sub.max_minutes_per_month);
    setFormAmount(sub.amount_cents);
    setFormExpires(sub.expires_at ? sub.expires_at.split("T")[0] : "");
    setError(null);
    setShowModal(true);
  };

  const handlePlanChange = (plan: string) => {
    setFormPlan(plan);
    const limits = PLAN_LIMITS[plan];
    if (limits) {
      setFormMaxCalls(limits.calls);
      setFormMaxMinutes(limits.minutes);
      setFormAmount(limits.amount);
    }
  };

  const handleSave = async () => {
    if (!formUserId) {
      setError("Please select a user");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: formUserId,
          plan: formPlan,
          status: formStatus,
          max_calls_per_month: formMaxCalls,
          max_minutes_per_month: formMaxMinutes,
          amount_cents: formAmount,
          expires_at: formExpires || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchSubscriptions();
      } else {
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Cancel this subscription?")) return;

    try {
      const res = await fetch(`/api/admin/subscriptions?user_id=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchSubscriptions();
      }
    } catch {
      // silent
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatAmount = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(cents / 100);
  };

  const getPlanConfig = (plan: string) => {
    switch (plan) {
      case "free": return { color: "text-gray-400", bg: "bg-gray-500/8", border: "border-gray-500/20", icon: "○" };
      case "basic": return { color: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/20", icon: "◆" };
      case "pro": return { color: "text-purple-400", bg: "bg-purple-500/8", border: "border-purple-500/20", icon: "★" };
      case "enterprise": return { color: "text-amber-400", bg: "bg-amber-500/8", border: "border-amber-500/20", icon: "◈" };
      default: return { color: "text-gray-400", bg: "bg-gray-500/8", border: "border-gray-500/20", icon: "○" };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "active": return { color: "text-green-400", bg: "bg-green-500/8", border: "border-green-500/20", dot: "bg-green-400" };
      case "trial": return { color: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/20", dot: "bg-blue-400" };
      case "expired": return { color: "text-red-400", bg: "bg-red-500/8", border: "border-red-500/20", dot: "bg-red-400" };
      case "cancelled": return { color: "text-gray-400", bg: "bg-gray-500/8", border: "border-gray-500/20", dot: "bg-gray-400" };
      default: return { color: "text-gray-400", bg: "bg-gray-500/8", border: "border-gray-500/20", dot: "bg-gray-400" };
    }
  };

  const getUsagePercent = (used: number, max: number) => {
    if (max === 0) return 0;
    return Math.min(100, Math.round((used / max) * 100));
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return "bg-red-500";
    if (percent >= 70) return "bg-amber-500";
    return "bg-blue-500";
  };

  if (loading) {
    return (
      <div className="card p-10 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="spinner" />
          <span className="text-sm text-[var(--color-text-secondary)]">Loading subscriptions...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Subscription Section */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
            <div>
              <h2 className="admin-card-title">Subscriptions</h2>
              <p className="admin-card-subtitle">Manage plans, limits & billing per user</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-blue">
                {subscriptions.length} active
              </span>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Assign Plan
              </button>
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto p-1">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="text-left">User</th>
                <th className="text-center">Plan</th>
                <th className="text-center">Status</th>
                <th className="text-center">Calls Usage</th>
                <th className="text-center">Minutes Usage</th>
                <th className="text-center">Price/mo</th>
                <th className="text-center">Period</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => {
                const planCfg = getPlanConfig(sub.plan);
                const statusCfg = getStatusConfig(sub.status);
                const callPercent = getUsagePercent(sub.calls_used, sub.max_calls_per_month);
                const minPercent = getUsagePercent(sub.minutes_used, sub.max_minutes_per_month);

                return (
                  <tr key={sub.id}>
                    <td className="text-left">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-[10px] font-bold text-blue-400 uppercase shrink-0">
                          {sub.email?.charAt(0) || "?"}
                        </div>
                        <span className="text-white font-medium text-sm truncate max-w-[160px]">{sub.email}</span>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border capitalize ${planCfg.bg} ${planCfg.color} ${planCfg.border}`}>
                        <span className="text-[9px]">{planCfg.icon}</span>
                        {sub.plan}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border capitalize ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {sub.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-semibold text-white">{sub.calls_used}</span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">/ {sub.max_calls_per_month}</span>
                        </div>
                        <div className="w-full max-w-[80px] h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getUsageColor(callPercent)}`}
                            style={{ width: `${callPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-semibold text-white">{Math.round(sub.minutes_used)}</span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">/ {sub.max_minutes_per_month}</span>
                        </div>
                        <div className="w-full max-w-[80px] h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getUsageColor(minPercent)}`}
                            style={{ width: `${minPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className="text-sm font-semibold text-white">
                        {formatAmount(sub.amount_cents, sub.currency)}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] text-[var(--color-text-secondary)]">{formatDate(sub.started_at)}</span>
                        {sub.expires_at && (
                          <span className="text-[10px] text-[var(--color-text-muted)]">→ {formatDate(sub.expires_at)}</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => openEditModal(sub)}
                          className="p-2 rounded-lg hover:bg-white/5 text-[var(--color-text-muted)] hover:text-blue-400 transition-all"
                          title="Edit subscription"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(sub.user_id)}
                          className="p-2 rounded-lg hover:bg-red-500/8 text-[var(--color-text-muted)] hover:text-red-400 transition-all"
                          title="Remove subscription"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-[var(--color-text-muted)]">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                      </svg>
                      <span className="text-sm">No subscriptions assigned yet</span>
                      <button onClick={openAddModal} className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                        + Assign your first plan
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Tablet grid */}
        <div className="hidden md:grid lg:hidden grid-cols-2 gap-3 p-4">
          {subscriptions.map((sub) => {
            const planCfg = getPlanConfig(sub.plan);
            const statusCfg = getStatusConfig(sub.status);
            const callPercent = getUsagePercent(sub.calls_used, sub.max_calls_per_month);
            const minPercent = getUsagePercent(sub.minutes_used, sub.max_minutes_per_month);

            return (
              <div key={sub.id} className="p-4 rounded-xl border border-[var(--color-border)] bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-[9px] font-bold text-blue-400 uppercase">
                      {sub.email?.charAt(0) || "?"}
                    </div>
                    <span className="text-xs text-white font-medium truncate max-w-[120px]">{sub.email}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditModal(sub)} className="p-1 text-[var(--color-text-muted)] hover:text-blue-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                    </button>
                    <button onClick={() => handleDelete(sub.user_id)} className="p-1 text-[var(--color-text-muted)] hover:text-red-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border capitalize ${planCfg.bg} ${planCfg.color} ${planCfg.border}`}>{sub.plan}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md border capitalize ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                    <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />{sub.status}
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[var(--color-text-muted)]">Calls</span>
                      <span className="text-white">{sub.calls_used}/{sub.max_calls_per_month}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full rounded-full ${getUsageColor(callPercent)}`} style={{ width: `${callPercent}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-[var(--color-text-muted)]">Minutes</span>
                      <span className="text-white">{Math.round(sub.minutes_used)}/{sub.max_minutes_per_month}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full rounded-full ${getUsageColor(minPercent)}`} style={{ width: `${minPercent}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                  <span className="text-xs font-semibold text-white">{formatAmount(sub.amount_cents, sub.currency)}/mo</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">{formatDate(sub.expires_at)}</span>
                </div>
              </div>
            );
          })}
          {subscriptions.length === 0 && (
            <div className="col-span-2 p-10 text-center text-sm text-[var(--color-text-muted)]">
              No subscriptions assigned yet
            </div>
          )}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {subscriptions.map((sub) => {
            const planCfg = getPlanConfig(sub.plan);
            const statusCfg = getStatusConfig(sub.status);
            const callPercent = getUsagePercent(sub.calls_used, sub.max_calls_per_month);
            const minPercent = getUsagePercent(sub.minutes_used, sub.max_minutes_per_month);

            return (
              <div key={sub.id} className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-[10px] font-bold text-blue-400 uppercase">
                      {sub.email?.charAt(0) || "?"}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm text-white font-medium block truncate max-w-[160px]">{sub.email}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">Since {formatDate(sub.started_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditModal(sub)} className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--color-text-muted)] hover:text-blue-400 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                    </button>
                    <button onClick={() => handleDelete(sub.user_id)} className="p-1.5 rounded-lg hover:bg-red-500/8 text-[var(--color-text-muted)] hover:text-red-400 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    </button>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border capitalize ${planCfg.bg} ${planCfg.color} ${planCfg.border}`}>
                    {planCfg.icon} {sub.plan}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md border capitalize ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />{sub.status}
                  </span>
                  <span className="ml-auto text-xs font-semibold text-white">{formatAmount(sub.amount_cents, sub.currency)}/mo</span>
                </div>

                {/* Usage bars */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-[var(--color-text-muted)]">Calls</span>
                      <span className="text-[10px] font-medium text-white">{callPercent}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${getUsageColor(callPercent)}`} style={{ width: `${callPercent}%` }} />
                    </div>
                    <p className="text-[9px] text-[var(--color-text-muted)] mt-1">{sub.calls_used} / {sub.max_calls_per_month}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-[var(--color-text-muted)]">Minutes</span>
                      <span className="text-[10px] font-medium text-white">{minPercent}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${getUsageColor(minPercent)}`} style={{ width: `${minPercent}%` }} />
                    </div>
                    <p className="text-[9px] text-[var(--color-text-muted)] mt-1">{Math.round(sub.minutes_used)} / {sub.max_minutes_per_month}</p>
                  </div>
                </div>

                {sub.expires_at && (
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                    Expires {formatDate(sub.expires_at)}
                  </div>
                )}
              </div>
            );
          })}
          {subscriptions.length === 0 && (
            <div className="p-10 text-center">
              <svg className="w-8 h-8 mx-auto text-[var(--color-text-muted)] opacity-40 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
              </svg>
              <p className="text-sm text-[var(--color-text-muted)]">No subscriptions yet</p>
              <button onClick={openAddModal} className="mt-2 text-xs text-blue-400 hover:text-blue-300">+ Assign first plan</button>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg card p-5 sm:p-6 space-y-5 animate-in max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight">
                  {editingSub ? "Edit Subscription" : "Assign Subscription"}
                </h3>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {editingSub ? "Update plan details and limits" : "Select a user and configure their plan"}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-white/5 text-[var(--color-text-muted)] hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/20">
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}

            {/* User Select */}
            <div>
              <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-2">User</label>
              <select
                value={formUserId}
                onChange={(e) => setFormUserId(e.target.value)}
                disabled={!!editingSub}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-blue-500/50 disabled:opacity-50 transition-colors"
              >
                <option value="">Select a user...</option>
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>{u.email}</option>
                ))}
              </select>
            </div>

            {/* Plan Selection */}
            <div>
              <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-2">Plan</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["free", "basic", "pro", "enterprise"] as const).map((p) => {
                  const cfg = getPlanConfig(p);
                  const limits = PLAN_LIMITS[p];
                  return (
                    <button
                      key={p}
                      onClick={() => handlePlanChange(p)}
                      className={`relative p-3 text-left rounded-xl border transition-all ${
                        formPlan === p
                          ? "border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/20"
                          : "border-[var(--color-border)] hover:border-white/15 bg-white/[0.02]"
                      }`}
                    >
                      <span className={`text-xs font-semibold capitalize ${formPlan === p ? "text-blue-400" : cfg.color}`}>{p}</span>
                      <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{limits.calls} calls/mo</p>
                      {formPlan === p && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status Selection */}
            <div>
              <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-2">Status</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["active", "trial", "expired", "cancelled"] as const).map((s) => {
                  const cfg = getStatusConfig(s);
                  return (
                    <button
                      key={s}
                      onClick={() => setFormStatus(s)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-xl border transition-all capitalize ${
                        formStatus === s
                          ? `${cfg.border} ${cfg.bg} ${cfg.color}`
                          : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-white/15"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${formStatus === s ? cfg.dot : "bg-current opacity-40"}`} />
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-2">Max Calls/mo</label>
                <input
                  type="number"
                  value={formMaxCalls}
                  onChange={(e) => setFormMaxCalls(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-2">Max Minutes/mo</label>
                <input
                  type="number"
                  value={formMaxMinutes}
                  onChange={(e) => setFormMaxMinutes(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Price & Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-2">Price (cents)</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-2">Expires On</label>
                <input
                  type="date"
                  value={formExpires}
                  onChange={(e) => setFormExpires(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-sm rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-white/20 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 text-sm rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 disabled:opacity-50 disabled:shadow-none"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
                    Saving...
                  </span>
                ) : editingSub ? "Update Plan" : "Assign Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
