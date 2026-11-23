"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  Clock,
  CreditCard,
  Download,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Phone,
  PhoneCall,
  RefreshCw,
  Search,
  SearchX,
  TrendingUp,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import UserSubscriptions from "@/components/UserSubscriptions";
import "@/styles/admin-console.css";

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

interface Summary {
  totalUsers: number;
  calls: number;
  completed: number;
  failed: number;
  noAnswer: number;
  other: number;
  seconds: number;
  avgCallSeconds: number;
  successRate: number | null;
  active7: number;
  never: number;
}

type Tab = "overview" | "users" | "subscriptions";
type SortKey = "calls" | "success" | "last_active" | "registered" | "name";
type SortDir = "asc" | "desc";
type ActivityFilter = "all" | "active7" | "active30" | "never";

const PAGE_SIZE = 10;
const DAY_MS = 86_400_000;
const POLL_MS = 10_000;

const TAB_META: Record<Tab, { label: string; title: string; subtitle: string }> = {
  overview: { label: "Overview", title: "Dashboard Overview", subtitle: "Platform-wide call activity and usage" },
  users: { label: "Users", title: "User Management", subtitle: "Search, filter and export every account and its call activity" },
  subscriptions: { label: "Subscriptions", title: "Subscription Management", subtitle: "Manage plans, limits & billing per user" },
};

const SORT_LABELS: Record<SortKey, string> = {
  calls: "Total calls",
  success: "Success rate",
  last_active: "Last active",
  registered: "Registered",
  name: "Name",
};

const nf = new Intl.NumberFormat("en-IN");
const fmtInt = (n: number) => nf.format(Math.round(n || 0));
const fmtPct = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("en-IN")}%`;

const fmtDuration = (seconds: number) => {
  if (!seconds || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const fmtMinutes = (minutes: number) =>
  minutes > 0 && minutes < 10 ? minutes.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : fmtInt(minutes);

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const fmtDateTime = (iso: string | null) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const fmtRelative = (iso: string | null, now: number) => {
  if (!iso) return "Never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diff = now - t;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * DAY_MS) return `${Math.floor(diff / DAY_MS)}d ago`;
  return fmtDate(iso);
};

const successRateOf = (u: UserStats) => (u.total_calls > 0 ? (u.completed_calls / u.total_calls) * 100 : null);
const rateTone = (rate: number) => (rate >= 70 ? "good" : rate >= 40 ? "mid" : "low");
const displayName = (u: UserStats) => u.full_name || u.email.split("@")[0] || u.email;
const initialOf = (u: UserStats) => (displayName(u).trim().charAt(0) || "?").toUpperCase();
const ts = (iso: string | null) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

function csvCell(v: string | number, allowPlus = false) {
  let s = String(v ?? "");
  if (typeof v === "string" && (/^[=@\t\r]/.test(s) || (!allowPlus && /^[+-]/.test(s)))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportUsersCsv(users: UserStats[]) {
  const header = [
    "Name", "Email", "Phone", "Registered", "Total calls", "Completed", "Failed", "No answer",
    "Success rate (%)", "Total talk time (s)", "Avg call duration (s)", "Last active",
  ];
  const rows = users.map((u) => {
    const rate = successRateOf(u);
    return [
      csvCell(u.full_name),
      csvCell(u.email),
      csvCell(u.phone, true),
      csvCell(u.registered_at ?? ""),
      u.total_calls,
      u.completed_calls,
      u.failed_calls,
      u.no_answer_calls,
      rate === null ? "" : Math.round(rate * 10) / 10,
      Math.round(u.total_duration_seconds),
      Math.round(u.avg_duration_seconds),
      csvCell(u.last_call_at ?? ""),
    ].join(",");
  });
  const blob = new Blob(["\uFEFF" + [header.join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nova-users-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function UserIdentity({ user }: { user: UserStats }) {
  return (
    <div className="ac-user">
      <div className="ac-avatar" aria-hidden="true">{initialOf(user)}</div>
      <div className="ac-user-text">
        <span className="ac-user-name" title={displayName(user)}>{displayName(user)}</span>
        <span className="ac-user-email" title={user.email}>{user.email}</span>
      </div>
    </div>
  );
}

function RateBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="ac-muted">—</span>;
  return (
    <div className="ac-rate">
      <div className="ac-bar" role="img" aria-label={`Success rate ${fmtPct(rate)}`}>
        <div className={`ac-bar-fill ${rateTone(rate)}`} style={{ width: `${Math.min(100, rate)}%` }} />
      </div>
      <span className="ac-rate-val">{fmtPct(rate)}</span>
    </div>
  );
}

function Kpi({ label, value, unit, sub, tone, icon }: {
  label: string; value: string; unit?: string; sub: string; tone: string; icon: React.ReactNode;
}) {
  return (
    <div className="ac-kpi">
      <div className="ac-kpi-top">
        <span className="ac-kpi-label">{label}</span>
        <span className={`ac-kpi-icon ${tone}`} aria-hidden="true">{icon}</span>
      </div>
      <div className="ac-kpi-value">{value}{unit && <small>{unit}</small>}</div>
      <div className="ac-kpi-sub">{sub}</div>
    </div>
  );
}

function OverviewTab({ summary, users, now, onGo }: {
  summary: Summary; users: UserStats[]; now: number; onGo: (tab: Tab) => void;
}) {
  const { calls, completed, failed, noAnswer, other } = summary;
  const pct = (n: number) => (calls > 0 ? (n / calls) * 100 : 0);

  const topUsers = useMemo(
    () => users.filter((u) => u.total_calls > 0).sort((a, b) => b.total_calls - a.total_calls).slice(0, 5),
    [users],
  );
  const recentUsers = useMemo(
    () =>
      users
        .filter((u) => ts(u.last_call_at) !== null)
        .sort((a, b) => (ts(b.last_call_at) ?? 0) - (ts(a.last_call_at) ?? 0))
        .slice(0, 5),
    [users],
  );

  const segments = [
    { key: "ok", label: "Completed", count: completed },
    { key: "fail", label: "Failed", count: failed },
    { key: "miss", label: "No answer", count: noAnswer },
    ...(other > 0 ? [{ key: "other", label: "Other / in progress", count: other }] : []),
  ];
  const maxCalls = topUsers[0]?.total_calls || 1;

  return (
    <div className="ac-page">
      <div className="ac-kpi-grid">
        <Kpi
          label="Total users"
          value={fmtInt(summary.totalUsers)}
          sub={`${fmtInt(summary.active7)} active in last 7 days · ${fmtInt(summary.never)} never called`}
          tone="tone-blue"
          icon={<Users />}
        />
        <Kpi
          label="Total calls"
          value={fmtInt(calls)}
          sub={summary.totalUsers > 0 ? `${(calls / summary.totalUsers).toLocaleString("en-IN", { maximumFractionDigits: 1 })} per user on average` : "No users yet"}
          tone="tone-violet"
          icon={<PhoneCall />}
        />
        <Kpi
          label="Talk time"
          value={fmtMinutes(summary.seconds / 60)}
          unit="min"
          sub={summary.seconds > 0 ? `${fmtDuration(summary.seconds)} total · ${fmtDuration(summary.avgCallSeconds)} avg per connected call` : "No talk time recorded"}
          tone="tone-amber"
          icon={<Clock />}
        />
        <Kpi
          label="Success rate"
          value={summary.successRate === null ? "—" : fmtPct(summary.successRate)}
          sub={calls > 0 ? `${fmtInt(completed)} of ${fmtInt(calls)} calls completed` : "No calls yet"}
          tone="tone-green"
          icon={<TrendingUp />}
        />
      </div>

      <section className="ac-card" aria-labelledby="ac-outcome-title">
        <div className="ac-card-head">
          <div>
            <h2 className="ac-card-title" id="ac-outcome-title">Call outcomes</h2>
            <p className="ac-card-sub">Share of all {fmtInt(calls)} logged calls by result</p>
          </div>
        </div>
        <div className="ac-card-body">
          {calls === 0 ? (
            <div className="ac-empty">
              <div className="ac-empty-icon"><Phone /></div>
              <h3>No calls logged yet</h3>
              <p>Outcome breakdown appears once users start placing calls.</p>
            </div>
          ) : (
            <>
              <div
                className="ac-seg"
                role="img"
                aria-label={`Call outcomes: ${segments.map((s) => `${fmtPct(pct(s.count))} ${s.label.toLowerCase()}`).join(", ")}`}
              >
                {segments.filter((s) => s.count > 0).map((s) => (
                  <div key={s.key} className={`ac-seg-part ac-seg-${s.key}`} style={{ width: `${pct(s.count)}%` }} title={`${s.label}: ${fmtInt(s.count)}`} />
                ))}
              </div>
              <div className="ac-legend">
                {segments.map((s) => (
                  <div key={s.key} className="ac-legend-item">
                    <span className="ac-legend-label"><i className={`ac-dot ac-dot-${s.key}`} />{s.label}</span>
                    <span className="ac-legend-value">{fmtInt(s.count)}<span>{fmtPct(pct(s.count))}</span></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <div className="ac-grid-2">
        <section className="ac-card" aria-labelledby="ac-top-title">
          <div className="ac-card-head">
            <div>
              <h2 className="ac-card-title" id="ac-top-title">Top users by call volume</h2>
              <p className="ac-card-sub">Highest total calls, all time</p>
            </div>
            <button className="ac-btn ac-btn-sm" onClick={() => onGo("users")}>View all</button>
          </div>
          {topUsers.length === 0 ? (
            <div className="ac-empty">
              <div className="ac-empty-icon"><Inbox /></div>
              <h3>No call activity yet</h3>
              <p>Users with calls will be ranked here.</p>
            </div>
          ) : (
            <ol className="ac-list">
              {topUsers.map((u, i) => (
                <li key={u.user_id} className="ac-list-row">
                  <span className="ac-rank">{i + 1}</span>
                  <div className="ac-list-main">
                    <UserIdentity user={u} />
                    <div className="ac-bar" role="img" aria-label={`${fmtInt(u.total_calls)} calls`}>
                      <div className="ac-bar-fill" style={{ width: `${(u.total_calls / maxCalls) * 100}%` }} />
                    </div>
                  </div>
                  <div className="ac-list-meta">
                    <span className="ac-list-value">{fmtInt(u.total_calls)}</span>
                    <span className="ac-list-sub">{fmtPct(pct(u.total_calls))} of calls</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="ac-card" aria-labelledby="ac-recent-title">
          <div className="ac-card-head">
            <div>
              <h2 className="ac-card-title" id="ac-recent-title">Recently active users</h2>
              <p className="ac-card-sub">Latest call placed</p>
            </div>
          </div>
          {recentUsers.length === 0 ? (
            <div className="ac-empty">
              <div className="ac-empty-icon"><Activity /></div>
              <h3>No recent activity</h3>
              <p>Users who place calls will show up here.</p>
            </div>
          ) : (
            <ul className="ac-list">
              {recentUsers.map((u) => {
                const rate = successRateOf(u);
                return (
                  <li key={u.user_id} className="ac-list-row">
                    <div className="ac-list-main"><UserIdentity user={u} /></div>
                    <div className="ac-list-meta">
                      <span className="ac-list-value" title={fmtDateTime(u.last_call_at)}>{fmtRelative(u.last_call_at, now)}</span>
                      <span className="ac-list-sub">{fmtInt(u.total_calls)} calls{rate !== null ? ` · ${fmtPct(rate)} success` : ""}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function UsersTab({ users, now }: { users: UserStats[]; now: number }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("calls");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return users.filter((u) => {
      if (q) {
        const hit =
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          (qDigits.length >= 3 && u.phone.replace(/\D/g, "").includes(qDigits));
        if (!hit) return false;
      }
      const last = ts(u.last_call_at);
      if (filter === "never") return last === null;
      if (filter === "active7") return last !== null && now - last <= 7 * DAY_MS;
      if (filter === "active30") return last !== null && now - last <= 30 * DAY_MS;
      return true;
    });
  }, [users, query, filter, now]);

  const sorted = useMemo(() => {
    const value = (u: UserStats): number | string | null => {
      switch (sortKey) {
        case "calls": return u.total_calls;
        case "success": return successRateOf(u);
        case "last_active": return ts(u.last_call_at);
        case "registered": return ts(u.registered_at);
        default: return displayName(u).toLowerCase();
      }
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av === null && bv === null) return displayName(a).localeCompare(displayName(b));
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number);
      return cmp !== 0 ? cmp * dir : displayName(a).localeCompare(displayName(b));
    });
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const rows = sorted.slice(start, start + PAGE_SIZE);
  const isFiltered = query.trim() !== "" || filter !== "all";

  const changeSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
    setPage(1);
  };

  const clearFilters = () => {
    setQuery("");
    setFilter("all");
    setPage(1);
  };

  const sortTh = (k: SortKey, label: string, numeric = false) => (
    <th
      className={numeric ? "ac-num" : undefined}
      aria-sort={sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" className="ac-th-btn" onClick={() => changeSort(k)}>
        {label}
        {sortKey === k ? (sortDir === "asc" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />) : <ChevronsUpDown aria-hidden="true" />}
      </button>
    </th>
  );

  const countLabel =
    sorted.length === 0
      ? "0 users"
      : `Showing ${fmtInt(start + 1)}–${fmtInt(start + rows.length)} of ${fmtInt(sorted.length)} user${sorted.length === 1 ? "" : "s"}${isFiltered ? ` (filtered from ${fmtInt(users.length)})` : ""}`;

  return (
    <div className="ac-page">
      <section className="ac-card" aria-labelledby="ac-users-title">
        <div className="ac-card-head">
          <div>
            <h2 className="ac-card-title" id="ac-users-title">All users</h2>
            <p className="ac-card-sub">{fmtInt(users.length)} registered account{users.length === 1 ? "" : "s"}</p>
          </div>
          <button className="ac-btn ac-btn-sm" onClick={() => exportUsersCsv(sorted)} disabled={sorted.length === 0} title="Download the filtered list as CSV">
            <Download aria-hidden="true" /> Export CSV
          </button>
        </div>

        <div className="ac-toolbar" role="search">
          <div className="ac-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search name, email or phone"
              aria-label="Search users by name, email or phone"
            />
            {query && (
              <button type="button" className="ac-search-clear" onClick={() => { setQuery(""); setPage(1); }} aria-label="Clear search">
                <X aria-hidden="true" />
              </button>
            )}
          </div>
          <select value={filter} onChange={(e) => { setFilter(e.target.value as ActivityFilter); setPage(1); }} aria-label="Filter by activity">
            <option value="all">All users</option>
            <option value="active7">Active in last 7 days</option>
            <option value="active30">Active in last 30 days</option>
            <option value="never">Never called</option>
          </select>
          <div className="ac-sort-group">
            <select value={sortKey} onChange={(e) => changeSort(e.target.value as SortKey)} aria-label="Sort users by">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>Sort: {SORT_LABELS[k]}</option>
              ))}
            </select>
            <button
              type="button"
              className="ac-icon-btn"
              onClick={() => { setSortDir((d) => (d === "asc" ? "desc" : "asc")); setPage(1); }}
              aria-label={`Sort direction: ${sortDir === "asc" ? "ascending" : "descending"}. Click to reverse`}
              title={sortDir === "asc" ? "Ascending" : "Descending"}
            >
              {sortDir === "asc" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
            </button>
          </div>
          <span className="ac-count" aria-live="polite">{countLabel}</span>
        </div>

        {sorted.length === 0 ? (
          <div className="ac-empty">
            <div className="ac-empty-icon">{isFiltered ? <SearchX /> : <Users />}</div>
            <h3>{isFiltered ? "No users match your filters" : "No users yet"}</h3>
            <p>{isFiltered ? "Try a different search term or clear the active filters." : "Registered users will appear here."}</p>
            {isFiltered && <button className="ac-btn ac-btn-sm" onClick={clearFilters}>Clear filters</button>}
          </div>
        ) : (
          <>
            <div className="ac-table-wrap">
              <table className="ac-table">
                <thead>
                  <tr>
                    {sortTh("name", "User")}
                    <th>Phone</th>
                    {sortTh("registered", "Registered")}
                    {sortTh("calls", "Calls", true)}
                    <th>Outcomes</th>
                    {sortTh("success", "Success rate")}
                    <th className="ac-num">Talk time</th>
                    {sortTh("last_active", "Last active")}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.user_id}>
                      <td><UserIdentity user={u} /></td>
                      <td>{u.phone ? <span className="ac-mono">{u.phone}</span> : <span className="ac-muted">—</span>}</td>
                      <td className="ac-muted" title={fmtDateTime(u.registered_at)}>{fmtDate(u.registered_at)}</td>
                      <td className="ac-num"><span className="ac-strong">{fmtInt(u.total_calls)}</span></td>
                      <td>
                        <span className="ac-outcomes">
                          <span className={`ac-chip ok${u.completed_calls ? "" : " zero"}`} title="Completed"><i />{fmtInt(u.completed_calls)}</span>
                          <span className={`ac-chip fail${u.failed_calls ? "" : " zero"}`} title="Failed"><i />{fmtInt(u.failed_calls)}</span>
                          <span className={`ac-chip miss${u.no_answer_calls ? "" : " zero"}`} title="No answer"><i />{fmtInt(u.no_answer_calls)}</span>
                        </span>
                      </td>
                      <td><RateBar rate={successRateOf(u)} /></td>
                      <td className="ac-num">
                        <div className="ac-stack">
                          <span>{fmtDuration(u.total_duration_seconds)}</span>
                          {u.avg_duration_seconds > 0 && <span className="ac-muted ac-xs">avg {fmtDuration(u.avg_duration_seconds)}</span>}
                        </div>
                      </td>
                      <td>
                        {u.last_call_at ? (
                          <div className="ac-stack" title={fmtDateTime(u.last_call_at)}>
                            <span>{fmtRelative(u.last_call_at, now)}</span>
                            {fmtRelative(u.last_call_at, now) !== fmtDate(u.last_call_at) && (
                              <span className="ac-muted ac-xs">{fmtDate(u.last_call_at)}</span>
                            )}
                          </div>
                        ) : (
                          <span className="ac-never">Never</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ac-ucards">
              {rows.map((u) => (
                <article key={u.user_id} className="ac-ucard">
                  <UserIdentity user={u} />
                  <div className="ac-ucard-stats">
                    <div className="ac-ucard-stat"><b>{fmtInt(u.total_calls)}</b><span>Calls</span></div>
                    <div className="ac-ucard-stat ok"><b>{fmtInt(u.completed_calls)}</b><span>Done</span></div>
                    <div className="ac-ucard-stat fail"><b>{fmtInt(u.failed_calls)}</b><span>Failed</span></div>
                    <div className="ac-ucard-stat miss"><b>{fmtInt(u.no_answer_calls)}</b><span>Missed</span></div>
                  </div>
                  <RateBar rate={successRateOf(u)} />
                  <dl className="ac-ucard-meta">
                    <div><dt>Talk time</dt><dd>{fmtDuration(u.total_duration_seconds)}{u.avg_duration_seconds > 0 ? ` · avg ${fmtDuration(u.avg_duration_seconds)}` : ""}</dd></div>
                    <div><dt>Last active</dt><dd>{u.last_call_at ? fmtRelative(u.last_call_at, now) : <span className="ac-never">Never</span>}</dd></div>
                    <div><dt>Registered</dt><dd>{fmtDate(u.registered_at)}</dd></div>
                    <div><dt>Phone</dt><dd>{u.phone ? <span className="ac-mono">{u.phone}</span> : "—"}</dd></div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="ac-pagination">
              <span>Page {fmtInt(safePage)} of {fmtInt(pageCount)}</span>
              <div className="ac-pagination-btns">
                <button className="ac-btn ac-btn-sm" onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page">
                  <ChevronLeft aria-hidden="true" /> Prev
                </button>
                <button className="ac-btn ac-btn-sm" onClick={() => setPage(safePage + 1)} disabled={safePage >= pageCount} aria-label="Next page">
                  Next <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const contentRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const fetchStats = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data.stats) {
        setStats({ ...data.stats, users: data.stats.users ?? [] });
        setError(null);
        setUnauthorized(false);
        const d = new Date();
        setLastUpdated(d);
        setNow(d.getTime());
      } else {
        setUnauthorized(res.status === 401);
        setError(res.status === 401 ? "Your admin session has expired. Please sign in again." : data?.error || `Request failed (${res.status})`);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      if (!document.hidden) fetchStats();
    }, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearInterval(interval);
      clearInterval(tick);
    };
  }, [fetchStats]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminEmail(data.user?.email ?? null)).catch(() => {});
  }, [supabase]);

  useEffect(() => {
    if (!sidebarOpen) return;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [sidebarOpen]);

  const selectTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    contentRef.current?.scrollTo({ top: 0 });
  }, []);

  const retry = () => {
    setLoading(true);
    setError(null);
    fetchStats(true);
  };

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  };

  const users = useMemo(() => stats?.users ?? [], [stats]);

  const summary = useMemo<Summary>(() => {
    let calls = 0, completed = 0, failed = 0, noAnswer = 0, seconds = 0, timedCalls = 0, active7 = 0, never = 0;
    for (const u of users) {
      calls += u.total_calls;
      completed += u.completed_calls;
      failed += u.failed_calls;
      noAnswer += u.no_answer_calls;
      seconds += u.total_duration_seconds;
      if (u.avg_duration_seconds > 0) timedCalls += Math.round(u.total_duration_seconds / u.avg_duration_seconds);
      const last = ts(u.last_call_at);
      if (last === null) never++;
      else if (now - last <= 7 * DAY_MS) active7++;
    }
    return {
      totalUsers: stats?.total_users ?? users.length,
      calls,
      completed,
      failed,
      noAnswer,
      other: Math.max(0, calls - completed - failed - noAnswer),
      seconds,
      avgCallSeconds: timedCalls > 0 ? seconds / timedCalls : 0,
      successRate: calls > 0 ? (completed / calls) * 100 : null,
      active7,
      never,
    };
  }, [users, stats, now]);

  if (loading) {
    return (
      <div className="ac2 ac-boot">
        <div className="ac-boot-card" role="status" aria-live="polite">
          <div className="ac-boot-mark"><PhoneCall aria-hidden="true" /></div>
          <h2>Nova AI Admin Console</h2>
          <p>Loading platform data…</p>
          <div className="ac-boot-bar"><i /></div>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="ac2 ac-boot">
        <div className="ac-boot-card" role="alert">
          <div className="ac-boot-mark err"><CircleAlert aria-hidden="true" /></div>
          <h2>{unauthorized ? "Session expired" : "Couldn’t load admin data"}</h2>
          <p>{error}</p>
          <div className="ac-boot-actions">
            {unauthorized ? (
              <Link href="/admin/login" className="ac-btn ac-btn-primary">Go to sign in</Link>
            ) : (
              <button className="ac-btn ac-btn-primary" onClick={retry}><RefreshCw aria-hidden="true" /> Try again</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const navItems: { tab: Tab; icon: React.ReactNode; badge?: string }[] = [
    { tab: "overview", icon: <LayoutDashboard aria-hidden="true" /> },
    { tab: "users", icon: <Users aria-hidden="true" />, badge: fmtInt(users.length) },
    { tab: "subscriptions", icon: <CreditCard aria-hidden="true" /> },
  ];
  const meta = TAB_META[activeTab];
  const adminLabel = adminEmail ?? "Administrator";

  return (
    <div className="admin-layout ac2">
      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      <aside id="ac-sidebar" className={`admin-sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Admin sidebar">
        <div className="ac-sidebar-head">
          <Link href="/" className="ac-brand" aria-label="Nova AI home">
            <span className="ac-brand-mark"><PhoneCall size={18} aria-hidden="true" /></span>
            <span className="ac-brand-text">
              <span className="ac-brand-name">Nova AI</span>
              <span className="ac-brand-tag">Admin Console</span>
            </span>
          </Link>
          <button ref={closeBtnRef} className="ac-icon-btn ac-sidebar-close" onClick={() => { setSidebarOpen(false); menuBtnRef.current?.focus(); }} aria-label="Close navigation menu">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="ac-nav">
          <nav className="ac-nav-group" aria-label="Admin sections">
            <p className="ac-nav-label">Workspace</p>
            {navItems.map(({ tab, icon, badge }) => (
              <button
                key={tab}
                className={`ac-nav-item ${activeTab === tab ? "active" : ""}`}
                onClick={() => selectTab(tab)}
                aria-current={activeTab === tab ? "page" : undefined}
              >
                {icon}
                <span>{TAB_META[tab].label}</span>
                {badge && <span className="ac-nav-badge">{badge}</span>}
              </button>
            ))}
          </nav>

          <div role="group" aria-label="Quick stats">
            <div className="ac-qs-head">
              <p className="ac-nav-label">Quick stats</p>
              <span className={`ac-live ac-live-sm ${error ? "stale" : ""}`}>
                <span className="ac-live-dot" />{error ? "Stale" : "Live"}
              </span>
            </div>
            <div className="ac-qs-grid">
              <div className="ac-qs-item"><span className="ac-qs-value">{fmtInt(summary.totalUsers)}</span><span className="ac-qs-label">Users</span></div>
              <div className="ac-qs-item"><span className="ac-qs-value">{fmtInt(summary.calls)}</span><span className="ac-qs-label">Calls</span></div>
              <div className="ac-qs-item"><span className="ac-qs-value">{summary.successRate === null ? "—" : fmtPct(summary.successRate)}</span><span className="ac-qs-label">Success</span></div>
            </div>
          </div>
        </div>

        <div className="ac-profile">
          <div className="ac-profile-avatar" aria-hidden="true">{adminLabel.charAt(0)}</div>
          <div className="ac-profile-text">
            <span className="ac-profile-name" title={adminLabel}>{adminLabel}</span>
            <span className="ac-profile-role">Administrator</span>
          </div>
          <button className="ac-icon-btn danger" onClick={handleLogout} disabled={signingOut} aria-label="Sign out" title="Sign out">
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              ref={menuBtnRef}
              className="ac-icon-btn ac-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
              aria-controls="ac-sidebar"
            >
              <Menu aria-hidden="true" />
            </button>
            <div className="ac-title-wrap">
              <h1 className="ac-title">{meta.title}</h1>
              <p className="ac-subtitle">{meta.subtitle}</p>
            </div>
          </div>
          <div className="ac-topbar-right">
            <span className="ac-updated">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
            </span>
            <button className="ac-icon-btn" onClick={() => fetchStats(true)} disabled={refreshing} aria-label="Refresh data" title="Refresh data">
              <RefreshCw className={refreshing ? "ac-spin" : undefined} aria-hidden="true" />
            </button>
            <span className={`ac-live ${error ? "stale" : ""}`} role="status">
              <span className="ac-live-dot" />{error ? "Offline" : "Live"}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <div className="admin-content" ref={contentRef}>
          {error && (
            <div className="ac-page" style={{ marginBottom: "1rem" }}>
              <div className="ac-banner" role="alert">
                <TriangleAlert aria-hidden="true" />
                <span><strong>Couldn’t refresh data.</strong> {error} Showing the last successful update{lastUpdated ? ` (${lastUpdated.toLocaleTimeString("en-IN")})` : ""}.</span>
                {unauthorized ? (
                  <Link href="/admin/login" className="ac-btn ac-btn-sm">Sign in</Link>
                ) : (
                  <button className="ac-btn ac-btn-sm" onClick={() => fetchStats(true)} disabled={refreshing}>Retry</button>
                )}
              </div>
            </div>
          )}

          <div className="animate-in" key={activeTab}>
            {activeTab === "overview" && <OverviewTab summary={summary} users={users} now={now} onGo={selectTab} />}
            {activeTab === "users" && <UsersTab users={users} now={now} />}
            {activeTab === "subscriptions" && (
              <UserSubscriptions
                users={users.map((u) => ({ user_id: u.user_id, email: u.email, full_name: u.full_name }))}
              />
            )}
          </div>
        </div>
      </main>

      <nav className="admin-mobile-bottom-nav" aria-label="Primary">
        {navItems.map(({ tab, icon }) => (
          <button
            key={tab}
            className={`ac-bn-item ${activeTab === tab ? "active" : ""}`}
            onClick={() => selectTab(tab)}
            aria-current={activeTab === tab ? "page" : undefined}
          >
            {icon}
            <span>{tab === "subscriptions" ? "Plans" : TAB_META[tab].label}</span>
          </button>
        ))}
        <button className="ac-bn-item danger" onClick={handleLogout} disabled={signingOut}>
          <LogOut aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </nav>
    </div>
  );
}
