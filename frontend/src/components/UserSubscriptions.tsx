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

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case "free": return "bg-gray-500/10 text-gray-400 border-gray-500/20";
      case "basic": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "pro": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "enterprise": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default: return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-400 border-green-500/20";
      case "trial": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "expired": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "cancelled": return "bg-gray-500/10 text-gray-400 border-gray-500/20";
      default: return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const getUsagePercent = (used: number, max: number) => {
    if (max === 0) return 0;
    return Math.min(100, Math.round((used / max) * 100));
  };

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <span className="spinner" />
        <span className="text-[var(--color-text-secondary)] ml-2">Loading subscriptions...</span>
      </div>
    );
  }

  return (
    <>
      {/* Subscription Section */}
      <div className="card overflow-hidden !p-0">
        <div className="p-5 sm:p-6 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">User Subscriptions</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Manage plans and usage limits per user</p>
            </div>
            <button
              onClick={openAddModal}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
            >
              + Assign Plan
            </button>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th className="text-left">User</th>
                <th className="text-center">Plan</th>
                <th className="text-center">Status</th>
                <th className="text-center">Calls Usage</th>
                <th className="text-center">Minutes Usage</th>
                <th className="text-center">Price/mo</th>
                <th className="text-center">Started</th>
                <th className="text-center">Expires</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td className="text-left">
                    <span className="text-white font-medium">{sub.email}</span>
                  </td>
                  <td className="text-center">
                    <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border capitalize ${getPlanBadgeColor(sub.plan)}`}>
                      {sub.plan}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border capitalize ${getStatusBadgeColor(sub.status)}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-white">{sub.calls_used} / {sub.max_calls_per_month}</span>
                      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all"
                          style={{ width: `${getUsagePercent(sub.calls_used, sub.max_calls_per_month)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-white">{Math.round(sub.minutes_used)} / {sub.max_minutes_per_month}</span>
                      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${getUsagePercent(sub.minutes_used, sub.max_minutes_per_month)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="text-center text-white text-sm">
                    {formatAmount(sub.amount_cents, sub.currency)}
                  </td>
                  <td className="text-center text-[var(--color-text-secondary)] text-xs">
                    {formatDate(sub.started_at)}
                  </td>
                  <td className="text-center text-[var(--color-text-secondary)] text-xs">
                    {formatDate(sub.expires_at)}
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEditModal(sub)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--color-text-secondary)] hover:text-white transition-colors"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(sub.user_id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--color-text-secondary)] hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-[var(--color-text-muted)]">
                    No subscriptions assigned yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-medium truncate max-w-[180px]">{sub.email}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${getPlanBadgeColor(sub.plan)}`}>
                    {sub.plan}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${getStatusBadgeColor(sub.status)}`}>
                    {sub.status}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-[10px] text-[var(--color-text-muted)] mb-1">Calls</p>
                  <p className="text-xs text-white">{sub.calls_used} / {sub.max_calls_per_month}</p>
                  <div className="w-full h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-purple-500" style={{ width: `${getUsagePercent(sub.calls_used, sub.max_calls_per_month)}%` }} />
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.02]">
                  <p className="text-[10px] text-[var(--color-text-muted)] mb-1">Minutes</p>
                  <p className="text-xs text-white">{Math.round(sub.minutes_used)} / {sub.max_minutes_per_month}</p>
                  <div className="w-full h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${getUsagePercent(sub.minutes_used, sub.max_minutes_per_month)}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)]">{formatAmount(sub.amount_cents, sub.currency)}/mo</span>
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(sub)} className="text-purple-400 hover:text-purple-300">Edit</button>
                  <button onClick={() => handleDelete(sub.user_id)} className="text-red-400 hover:text-red-300">Remove</button>
                </div>
              </div>
            </div>
          ))}
          {subscriptions.length === 0 && (
            <div className="p-8 text-center text-sm text-[var(--color-text-muted)]">
              No subscriptions assigned yet
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md card p-6 space-y-4 animate-in">
            <h3 className="text-lg font-semibold text-white">
              {editingSub ? "Edit Subscription" : "Assign Subscription"}
            </h3>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* User Select */}
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">User</label>
              <select
                value={formUserId}
                onChange={(e) => setFormUserId(e.target.value)}
                disabled={!!editingSub}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
              >
                <option value="">Select a user...</option>
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>{u.email}</option>
                ))}
              </select>
            </div>

            {/* Plan */}
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Plan</label>
              <div className="grid grid-cols-4 gap-1.5">
                {["free", "basic", "pro", "enterprise"].map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePlanChange(p)}
                    className={`px-2 py-1.5 text-xs rounded-lg border transition-all capitalize ${
                      formPlan === p
                        ? "border-purple-500 bg-purple-500/10 text-purple-400"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-white/20"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Status</label>
              <div className="grid grid-cols-4 gap-1.5">
                {["active", "trial", "expired", "cancelled"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFormStatus(s)}
                    className={`px-2 py-1.5 text-xs rounded-lg border transition-all capitalize ${
                      formStatus === s
                        ? "border-green-500 bg-green-500/10 text-green-400"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-white/20"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Max Calls/mo</label>
                <input
                  type="number"
                  value={formMaxCalls}
                  onChange={(e) => setFormMaxCalls(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Max Minutes/mo</label>
                <input
                  type="number"
                  value={formMaxMinutes}
                  onChange={(e) => setFormMaxMinutes(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Amount & Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Price (cents)</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Expires</label>
                <input
                  type="date"
                  value={formExpires}
                  onChange={(e) => setFormExpires(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editingSub ? "Update" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
