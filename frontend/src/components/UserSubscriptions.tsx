"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PlanId = "free" | "basic" | "pro" | "enterprise";
type StatusId = "active" | "trial" | "expired" | "cancelled";

interface Subscription {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  plan: string;
  status: string;
  max_calls_per_month: number;
  calls_used: number;
  max_minutes_per_month: number;
  minutes_used: number;
  amount_cents: number; // minor units (paise for INR)
  currency: string;
  started_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
}

interface UserOption {
  user_id: string;
  email: string;
  full_name?: string;
}

interface PlanDefinition {
  id: PlanId;
  price: number; // major units (₹ per month)
  calls: number;
  minutes: number;
}

// Mirrors the self-serve pricing used by /api/payment so admin-assigned plans match what customers pay.
const PLANS: PlanDefinition[] = [
  { id: "free", price: 0, calls: 50, minutes: 100 },
  { id: "basic", price: 999, calls: 200, minutes: 500 },
  { id: "pro", price: 2999, calls: 1000, minutes: 2000 },
  { id: "enterprise", price: 9999, calls: 10000, minutes: 20000 },
];

const STATUSES: StatusId[] = ["active", "trial", "expired", "cancelled"];
const PAGE_SIZE = 10;
const DAY_MS = 86_400_000;
const EXPIRING_SOON_DAYS = 7;
const NEAR_LIMIT_PERCENT = 90;

interface Row extends Subscription {
  effectiveStatus: StatusId;
  callPercent: number;
  minutePercent: number;
  daysLeft: number | null;
  expiringSoon: boolean;
  nearLimit: boolean;
}

function formatMoney(minor: number, currency: string) {
  const amount = minor / 100;
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function toDateInput(daysFromToday: number | null) {
  if (daysFromToday === null) return "";
  return new Date(Date.now() + daysFromToday * DAY_MS).toISOString().split("T")[0];
}

function percentOf(used: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

function usageTone(percent: number) {
  if (percent >= NEAR_LIMIT_PERCENT) return "subs-bar-crit";
  if (percent >= 70) return "subs-bar-warn";
  return "subs-bar-ok";
}

function renewalInfo(row: Row) {
  if (row.effectiveStatus === "cancelled") {
    return { label: row.cancelled_at ? `Cancelled ${formatDate(row.cancelled_at)}` : "Cancelled", tone: "" };
  }
  if (!row.expires_at) return { label: "No expiry", tone: "" };
  if (row.daysLeft === null) return { label: formatDate(row.expires_at), tone: "" };
  if (row.daysLeft < 0) {
    const ago = Math.abs(row.daysLeft);
    return { label: `Expired ${ago} day${ago === 1 ? "" : "s"} ago`, tone: "subs-renewal-crit" };
  }
  if (row.daysLeft === 0) return { label: "Expires today", tone: "subs-renewal-crit" };
  return {
    label: `${row.daysLeft} day${row.daysLeft === 1 ? "" : "s"} left`,
    tone: row.daysLeft <= EXPIRING_SOON_DAYS ? "subs-renewal-warn" : "",
  };
}

function PlanPill({ plan }: { plan: string }) {
  return <span className={`subs-pill subs-plan-${plan}`}>{plan}</span>;
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`subs-pill subs-status-${status}`}>
      <span className="subs-pill-dot" />
      {status}
    </span>
  );
}

function UsageMeter({ label, used, max, percent }: { label: string; used: number; max: number; percent: number }) {
  return (
    <div className="subs-usage">
      <div className="subs-usage-top">
        <span className="subs-usage-label">{label}</span>
        <span className="subs-usage-value">
          {Math.round(used).toLocaleString("en-IN")} <span>/ {max.toLocaleString("en-IN")}</span>
        </span>
      </div>
      <div className="subs-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} used`}>
        <div className={`subs-bar-fill ${usageTone(percent)}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="subs-usage-pct">{percent}% used</p>
    </div>
  );
}

const EditIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
  </svg>
);

const TrashIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);

export default function UserSubscriptions({ users }: { users: UserOption[] }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusId>("all");
  const [planFilter, setPlanFilter] = useState<"all" | PlanId>("all");
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formUserId, setFormUserId] = useState("");
  const [formPlan, setFormPlan] = useState<PlanId>("free");
  const [formStatus, setFormStatus] = useState<StatusId>("active");
  const [formMaxCalls, setFormMaxCalls] = useState(50);
  const [formMaxMinutes, setFormMaxMinutes] = useState(100);
  const [formPrice, setFormPrice] = useState(0);
  const [formExpires, setFormExpires] = useState("");
  const [formResetUsage, setFormResetUsage] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<Subscription | null>(null);
  const [removing, setRemoving] = useState(false);

  const showNotice = useCallback((type: "success" | "error", text: string) => {
    setNotice({ type, text });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/subscriptions");
      const data = await res.json();
      if (data.success) {
        setSubscriptions(data.subscriptions);
        setNow(Date.now());
        setLoadError(null);
      } else {
        setLoadError(data.error || "Failed to load subscriptions");
      }
    } catch {
      setLoadError("Network error while loading subscriptions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const rows = useMemo<Row[]>(() => {
    return subscriptions.map((sub) => {
      const expiresMs = sub.expires_at ? new Date(sub.expires_at).getTime() : null;
      const daysLeft = expiresMs === null ? null : Math.floor((expiresMs - now) / DAY_MS);
      const live = sub.status === "active" || sub.status === "trial";
      const effectiveStatus = (live && expiresMs !== null && expiresMs < now ? "expired" : sub.status) as StatusId;
      const callPercent = percentOf(sub.calls_used, sub.max_calls_per_month);
      const minutePercent = percentOf(sub.minutes_used, sub.max_minutes_per_month);
      const isLive = effectiveStatus === "active" || effectiveStatus === "trial";
      return {
        ...sub,
        effectiveStatus,
        callPercent,
        minutePercent,
        daysLeft,
        expiringSoon: isLive && daysLeft !== null && daysLeft >= 0 && daysLeft <= EXPIRING_SOON_DAYS,
        nearLimit: isLive && (callPercent >= NEAR_LIMIT_PERCENT || minutePercent >= NEAR_LIMIT_PERCENT),
      };
    });
  }, [subscriptions, now]);

  const unassignedUsers = useMemo(() => {
    const assigned = new Set(subscriptions.map((s) => s.user_id));
    return users.filter((u) => !assigned.has(u.user_id));
  }, [users, subscriptions]);

  const summary = useMemo(() => {
    const live = rows.filter((r) => r.effectiveStatus === "active" || r.effectiveStatus === "trial");
    const revenueByCurrency: Record<string, number> = {};
    let payingCount = 0;
    for (const r of rows) {
      if (r.effectiveStatus === "active" && r.amount_cents > 0) {
        revenueByCurrency[r.currency] = (revenueByCurrency[r.currency] || 0) + r.amount_cents;
        payingCount += 1;
      }
    }
    const revenueLabel = Object.keys(revenueByCurrency).length
      ? Object.entries(revenueByCurrency).map(([cur, minor]) => formatMoney(minor, cur)).join(" + ")
      : formatMoney(0, "INR");
    return {
      total: rows.length,
      active: live.length,
      trials: rows.filter((r) => r.effectiveStatus === "trial").length,
      revenueLabel,
      payingCount,
      expiringSoon: rows.filter((r) => r.expiringSoon).length,
      nearLimit: rows.filter((r) => r.nearLimit).length,
      attention: rows.filter((r) => r.expiringSoon || r.nearLimit).length,
      lapsed: rows.filter((r) => r.effectiveStatus === "expired").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.effectiveStatus !== statusFilter) return false;
      if (planFilter !== "all" && r.plan !== planFilter) return false;
      if (q && !`${r.email} ${r.full_name || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, statusFilter, planFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasFilters = query.trim() !== "" || statusFilter !== "all" || planFilter !== "all";

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setPlanFilter("all");
    setPage(1);
  };

  const applyPlanDefaults = (planId: PlanId, withExpiry: boolean) => {
    const def = PLANS.find((p) => p.id === planId);
    setFormPlan(planId);
    if (!def) return;
    setFormMaxCalls(def.calls);
    setFormMaxMinutes(def.minutes);
    setFormPrice(def.price);
    if (withExpiry) setFormExpires(def.price > 0 ? toDateInput(30) : "");
  };

  const openAddModal = (userId = "") => {
    setEditingSub(null);
    setFormUserId(userId);
    setFormStatus("active");
    setFormResetUsage(false);
    applyPlanDefaults("free", true);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (sub: Subscription) => {
    setEditingSub(sub);
    setFormUserId(sub.user_id);
    setFormPlan(sub.plan as PlanId);
    setFormStatus(sub.status as StatusId);
    setFormMaxCalls(sub.max_calls_per_month);
    setFormMaxMinutes(sub.max_minutes_per_month);
    setFormPrice(sub.amount_cents / 100);
    setFormExpires(sub.expires_at ? sub.expires_at.split("T")[0] : "");
    setFormResetUsage(false);
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formUserId) {
      setFormError("Please select a user.");
      return;
    }
    if (![formMaxCalls, formMaxMinutes].every((n) => Number.isInteger(n) && n >= 0) || !(formPrice >= 0)) {
      setFormError("Limits and price must be zero or greater.");
      return;
    }
    setSaving(true);
    setFormError(null);

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
          amount_cents: Math.round(formPrice * 100),
          currency: editingSub?.currency || "INR",
          expires_at: formExpires || null,
          reset_usage: formResetUsage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        showNotice("success", editingSub ? "Subscription updated." : "Plan assigned successfully.");
        fetchSubscriptions();
      } else {
        setFormError(data.error || "Failed to save subscription.");
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/subscriptions?user_id=${encodeURIComponent(removeTarget.user_id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showNotice("success", `Subscription removed for ${removeTarget.email}.`);
        setRemoveTarget(null);
        fetchSubscriptions();
      } else {
        showNotice("error", data.error || "Failed to remove subscription.");
      }
    } catch {
      showNotice("error", "Network error. Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  const exportCsv = () => {
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ["Email", "Name", "Plan", "Status", "Calls used", "Calls limit", "Minutes used", "Minutes limit", "Price", "Currency", "Started", "Expires"];
    const lines = filtered.map((r) => [
      r.email, r.full_name || "", r.plan, r.effectiveStatus,
      r.calls_used, r.max_calls_per_month, Math.round(r.minutes_used), r.max_minutes_per_month,
      r.amount_cents / 100, r.currency,
      r.started_at ? r.started_at.split("T")[0] : "", r.expires_at ? r.expires_at.split("T")[0] : "",
    ].map(escape).join(","));
    const blob = new Blob([[header.map(escape).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `subscriptions-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const modalUsers = editingSub
    ? users.filter((u) => u.user_id === editingSub.user_id)
    : unassignedUsers;
  const planLabel = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

  if (loading) {
    return (
      <div className="admin-card">
        <div className="subs-empty">
          <span className="spinner" />
          <span>Loading subscriptions…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="subs-root">
      {loadError && (
        <div className="subs-form-error" role="alert">
          {loadError}{" "}
          <button className="subs-btn" onClick={fetchSubscriptions} style={{ marginLeft: "0.5rem" }}>Retry</button>
        </div>
      )}

      {/* Summary */}
      <div className="subs-kpi-grid">
        <div className="subs-kpi">
          <span className="subs-kpi-label">Subscriptions</span>
          <span className="subs-kpi-value">{summary.total}</span>
          <span className="subs-kpi-sub">
            {unassignedUsers.length} user{unassignedUsers.length === 1 ? "" : "s"} without a plan
          </span>
        </div>
        <div className="subs-kpi">
          <span className="subs-kpi-label">Active</span>
          <span className="subs-kpi-value">{summary.active}</span>
          <span className="subs-kpi-sub">
            {summary.trials} on trial · {summary.lapsed} lapsed
          </span>
        </div>
        <div className="subs-kpi">
          <span className="subs-kpi-label">Monthly recurring revenue</span>
          <span className="subs-kpi-value">{summary.revenueLabel}</span>
          <span className="subs-kpi-sub">
            from {summary.payingCount} paying subscriber{summary.payingCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className={`subs-kpi ${summary.attention > 0 ? "subs-kpi-warn" : ""}`}>
          <span className="subs-kpi-label">Needs attention</span>
          <span className="subs-kpi-value">{summary.attention}</span>
          <span className="subs-kpi-sub">
            {summary.expiringSoon} expiring ≤ {EXPIRING_SOON_DAYS}d · {summary.nearLimit} near limit
          </span>
        </div>
      </div>

      {/* Table card */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Subscriptions</h2>
            <p className="admin-card-subtitle">Plans, usage limits and billing status per customer</p>
          </div>
          <div className="subs-head-actions">
            <button className="subs-btn" onClick={exportCsv} disabled={filtered.length === 0}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </button>
            <button className="subs-btn subs-btn-primary" onClick={() => openAddModal()} disabled={unassignedUsers.length === 0} title={unassignedUsers.length === 0 ? "Every user already has a subscription" : undefined}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Assign plan
            </button>
          </div>
        </div>

        <div className="subs-toolbar">
          <div className="subs-search">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="search"
              placeholder="Search by name or email"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              aria-label="Search subscriptions"
            />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as "all" | StatusId); setPage(1); }} aria-label="Filter by status">
            <option value="all">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{planLabel(s)}</option>)}
          </select>
          <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value as "all" | PlanId); setPage(1); }} aria-label="Filter by plan">
            <option value="all">All plans</option>
            {PLANS.map((p) => <option key={p.id} value={p.id}>{planLabel(p.id)}</option>)}
          </select>
          {hasFilters && <button className="subs-btn" onClick={resetFilters}>Clear</button>}
          <span className="subs-count">
            {filtered.length} of {rows.length} subscription{rows.length === 1 ? "" : "s"}
          </span>
        </div>

        {pageRows.length === 0 ? (
          <div className="subs-empty">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
            </svg>
            <span>{hasFilters ? "No subscriptions match your filters." : "No subscriptions assigned yet."}</span>
            {hasFilters
              ? <button className="subs-btn" onClick={resetFilters}>Clear filters</button>
              : unassignedUsers.length > 0 && <button className="subs-btn subs-btn-primary" onClick={() => openAddModal()}>Assign the first plan</button>}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="subs-table-wrap">
              <table className="subs-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Calls</th>
                    <th>Minutes</th>
                    <th className="subs-th-right">Price / month</th>
                    <th>Renewal</th>
                    <th className="subs-th-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const renewal = renewalInfo(row);
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="subs-customer">
                            <div className="subs-avatar">{(row.full_name || row.email).charAt(0)}</div>
                            <div className="subs-customer-text">
                              <span className="subs-customer-name">{row.full_name || row.email}</span>
                              {row.full_name && <span className="subs-customer-email">{row.email}</span>}
                            </div>
                          </div>
                        </td>
                        <td><PlanPill plan={row.plan} /></td>
                        <td><StatusPill status={row.effectiveStatus} /></td>
                        <td><UsageMeter label="Calls" used={row.calls_used} max={row.max_calls_per_month} percent={row.callPercent} /></td>
                        <td><UsageMeter label="Minutes" used={row.minutes_used} max={row.max_minutes_per_month} percent={row.minutePercent} /></td>
                        <td className="subs-td-right"><span className="subs-price">{formatMoney(row.amount_cents, row.currency)}</span></td>
                        <td>
                          <div className="subs-renewal">
                            <span className={`subs-renewal-main ${renewal.tone}`}>{renewal.label}</span>
                            <span className="subs-muted">
                              {row.expires_at ? `Ends ${formatDate(row.expires_at)}` : `Since ${formatDate(row.started_at)}`}
                            </span>
                          </div>
                        </td>
                        <td className="subs-td-right">
                          <div className="subs-row-actions">
                            <button className="subs-icon-btn" onClick={() => openEditModal(row)} title="Edit subscription" aria-label={`Edit subscription for ${row.email}`}><EditIcon /></button>
                            <button className="subs-icon-btn danger" onClick={() => setRemoveTarget(row)} title="Remove subscription" aria-label={`Remove subscription for ${row.email}`}><TrashIcon /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tablet / mobile cards */}
            <div className="subs-cards">
              {pageRows.map((row) => {
                const renewal = renewalInfo(row);
                return (
                  <div key={row.id} className="subs-card">
                    <div className="subs-card-head">
                      <div className="subs-customer">
                        <div className="subs-avatar">{(row.full_name || row.email).charAt(0)}</div>
                        <div className="subs-customer-text">
                          <span className="subs-customer-name">{row.full_name || row.email}</span>
                          {row.full_name && <span className="subs-customer-email">{row.email}</span>}
                        </div>
                      </div>
                      <div className="subs-row-actions">
                        <button className="subs-icon-btn" onClick={() => openEditModal(row)} aria-label={`Edit subscription for ${row.email}`}><EditIcon /></button>
                        <button className="subs-icon-btn danger" onClick={() => setRemoveTarget(row)} aria-label={`Remove subscription for ${row.email}`}><TrashIcon /></button>
                      </div>
                    </div>
                    <div className="subs-card-badges">
                      <PlanPill plan={row.plan} />
                      <StatusPill status={row.effectiveStatus} />
                    </div>
                    <div className="subs-card-usage">
                      <UsageMeter label="Calls" used={row.calls_used} max={row.max_calls_per_month} percent={row.callPercent} />
                      <UsageMeter label="Minutes" used={row.minutes_used} max={row.max_minutes_per_month} percent={row.minutePercent} />
                    </div>
                    <div className="subs-card-foot">
                      <div className="subs-renewal">
                        <span className={`subs-renewal-main ${renewal.tone}`}>{renewal.label}</span>
                        <span className="subs-muted">
                          {row.expires_at ? `Ends ${formatDate(row.expires_at)}` : `Since ${formatDate(row.started_at)}`}
                        </span>
                      </div>
                      <span className="subs-price">{formatMoney(row.amount_cents, row.currency)}<span className="subs-muted"> /mo</span></span>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length > PAGE_SIZE && (
              <div className="subs-pagination">
                <span>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="subs-pagination-btns">
                  <button className="subs-btn" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
                  <button className="subs-btn" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Assign / edit modal */}
      {showModal && (
        <div className="subs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="subs-modal" role="dialog" aria-modal="true" aria-labelledby="subs-modal-title">
            <div className="subs-modal-head">
              <div>
                <h3 id="subs-modal-title" className="subs-modal-title">{editingSub ? "Edit subscription" : "Assign subscription"}</h3>
                <p className="subs-modal-desc">
                  {editingSub ? "Update the plan, limits and billing details." : "Choose a user and configure their plan."}
                </p>
              </div>
              <button className="subs-icon-btn" onClick={() => setShowModal(false)} aria-label="Close">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="subs-modal-body">
              {formError && <div className="subs-form-error" role="alert">{formError}</div>}

              <div>
                <label className="admin-modal-label" htmlFor="subs-user">User</label>
                <select id="subs-user" value={formUserId} onChange={(e) => setFormUserId(e.target.value)} disabled={!!editingSub} className="admin-modal-input">
                  <option value="">{modalUsers.length ? "Select a user…" : "All users already have a plan"}</option>
                  {modalUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>{u.full_name ? `${u.full_name} — ${u.email}` : u.email}</option>
                  ))}
                </select>
                {!editingSub && <p className="subs-field-hint">Only users without an existing subscription are listed.</p>}
              </div>

              <div>
                <label className="admin-modal-label">Plan</label>
                <div className="subs-plan-grid">
                  {PLANS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`subs-plan-option ${formPlan === p.id ? "selected" : ""}`}
                      onClick={() => applyPlanDefaults(p.id, !editingSub)}
                    >
                      <span className="subs-plan-option-name">{p.id}</span>
                      <span className="subs-plan-option-price">{p.price === 0 ? "Free" : `₹${p.price.toLocaleString("en-IN")}/mo`}</span>
                      <span className="subs-plan-option-meta">{p.calls.toLocaleString("en-IN")} calls · {p.minutes.toLocaleString("en-IN")} min</span>
                    </button>
                  ))}
                </div>
                <p className="subs-field-hint">Selecting a plan fills in its standard limits and price. You can override them below.</p>
              </div>

              <div>
                <label className="admin-modal-label">Status</label>
                <div className="subs-status-grid">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`subs-plan-option ${formStatus === s ? "selected" : ""}`}
                      style={{ textAlign: "center", padding: "0.5rem" }}
                      onClick={() => setFormStatus(s)}
                    >
                      <span className="subs-plan-option-name" style={{ fontSize: "0.75rem" }}>{s}</span>
                    </button>
                  ))}
                </div>
                <p className="subs-field-hint">Only Active and Trial subscriptions can place calls.</p>
              </div>

              <div className="subs-form-row">
                <div>
                  <label className="admin-modal-label" htmlFor="subs-calls">Calls per month</label>
                  <input id="subs-calls" type="number" min={0} value={formMaxCalls} onChange={(e) => setFormMaxCalls(parseInt(e.target.value) || 0)} className="admin-modal-input" />
                </div>
                <div>
                  <label className="admin-modal-label" htmlFor="subs-minutes">Minutes per month</label>
                  <input id="subs-minutes" type="number" min={0} value={formMaxMinutes} onChange={(e) => setFormMaxMinutes(parseInt(e.target.value) || 0)} className="admin-modal-input" />
                </div>
              </div>

              <div className="subs-form-row">
                <div>
                  <label className="admin-modal-label" htmlFor="subs-price">Price per month ({editingSub?.currency === "USD" ? "$" : "₹"})</label>
                  <input id="subs-price" type="number" min={0} step="0.01" value={formPrice} onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)} className="admin-modal-input" />
                </div>
                <div>
                  <label className="admin-modal-label" htmlFor="subs-expiry">Expires on</label>
                  <input id="subs-expiry" type="date" value={formExpires} onChange={(e) => setFormExpires(e.target.value)} className="admin-modal-input" />
                </div>
              </div>

              <div>
                <div className="subs-presets">
                  <button type="button" className="subs-preset" onClick={() => setFormExpires(toDateInput(30))}>+30 days</button>
                  <button type="button" className="subs-preset" onClick={() => setFormExpires(toDateInput(90))}>+90 days</button>
                  <button type="button" className="subs-preset" onClick={() => setFormExpires(toDateInput(365))}>+1 year</button>
                  <button type="button" className="subs-preset" onClick={() => setFormExpires("")}>No expiry</button>
                </div>
                <p className="subs-field-hint">Presets are counted from today. The plan stays valid through the end of the expiry date.</p>
              </div>

              {editingSub && (
                <label className="subs-checkbox">
                  <input type="checkbox" checked={formResetUsage} onChange={(e) => setFormResetUsage(e.target.checked)} />
                  <span>
                    Reset usage counters
                    <span className="subs-field-hint" style={{ display: "block", marginTop: 0 }}>
                      Sets calls and minutes used back to 0 (currently {editingSub.calls_used} calls, {Math.round(editingSub.minutes_used)} min).
                    </span>
                  </span>
                </label>
              )}
            </div>

            <div className="subs-modal-foot">
              <button className="subs-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="subs-btn subs-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editingSub ? "Save changes" : "Assign plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirmation */}
      {removeTarget && (
        <div className="subs-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !removing) setRemoveTarget(null); }}>
          <div className="subs-modal subs-modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="subs-remove-title">
            <div className="subs-modal-head">
              <div>
                <h3 id="subs-remove-title" className="subs-modal-title">Remove subscription?</h3>
                <p className="subs-modal-desc">
                  This permanently deletes the {planLabel(removeTarget.plan)} subscription and its usage history for{" "}
                  <strong>{removeTarget.email}</strong>. They will no longer be able to place calls. To keep the record, set its status to Cancelled instead.
                </p>
              </div>
            </div>
            <div className="subs-modal-foot">
              <button className="subs-btn" onClick={() => setRemoveTarget(null)} disabled={removing}>Keep subscription</button>
              <button className="subs-btn subs-btn-danger" onClick={handleRemove} disabled={removing}>
                {removing ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className={`subs-notice subs-notice-${notice.type}`} role="status">{notice.text}</div>
      )}
    </div>
  );
}
