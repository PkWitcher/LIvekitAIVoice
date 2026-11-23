"use client";

import { ChartColumn, Users, Megaphone, IndianRupee } from "lucide-react";

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

interface AnalyticsBreakdownProps {
  conversionRate: number;
  dispositionBreakdown: Record<string, number>;
  agentBreakdown: AgentBreakdownRow[];
  campaignBreakdown: CampaignBreakdownRow[];
  costAnalytics: CostAnalytics;
}

const DISPOSITION_COLORS: Record<string, string> = {
  Interested: "#22c55e",
  Booked: "#10b981",
  "Callback Requested": "#3b82f6",
  "Not Interested": "#f87171",
  "Wrong Number": "#f59e0b",
  Voicemail: "#a78bfa",
  "No Answer": "#94a3b8",
  "No Response": "#94a3b8",
  Other: "#64748b",
};

const formatInr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const share = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

export default function AnalyticsBreakdown({
  conversionRate,
  dispositionBreakdown,
  agentBreakdown,
  campaignBreakdown,
  costAnalytics,
}: AnalyticsBreakdownProps) {
  const dispositionEntries = Object.entries(dispositionBreakdown).sort((a, b) => b[1] - a[1]);
  const dispositionTotal = dispositionEntries.reduce((sum, [, count]) => sum + count, 0);
  const agentCostTotal = costAnalytics.byAgent.reduce((sum, a) => sum + a.cost, 0);

  return (
    <div className="dh2-breakdown">
      <section className="dh2-panel" aria-labelledby="dh2-disp-title">
        <header className="dh2-panel-head">
          <h3 id="dh2-disp-title" className="dh2-panel-title">
            <ChartColumn size={16} aria-hidden="true" className="dh2-ico-violet" /> Disposition breakdown
          </h3>
          <span className="dh2-chip dh2-chip-good" title="Share of all calls in this period classified as a positive outcome">
            Conversion {conversionRate}%
          </span>
        </header>
        {dispositionEntries.length === 0 ? (
          <div className="dh2-empty dh2-empty-compact">
            <p className="dh2-empty-title">No classified calls yet</p>
            <p className="dh2-empty-text">Outcomes appear here once call transcripts are classified by AI.</p>
          </div>
        ) : (
          <ul className="dh2-disp-list">
            {dispositionEntries.map(([label, count]) => {
              const pct = share(count, dispositionTotal);
              return (
                <li key={label} className="dh2-disp-row">
                  <span className="dh2-disp-label" title={label}>
                    <i style={{ background: DISPOSITION_COLORS[label] ?? "#64748b" }} aria-hidden="true" />
                    {label}
                  </span>
                  <div className="dh2-bar dh2-bar-thin" role="img" aria-label={`${label}: ${count} calls, ${Math.round(pct)}%`}>
                    <div className="dh2-bar-fill" style={{ width: `${pct}%`, background: DISPOSITION_COLORS[label] ?? "#64748b" }} />
                  </div>
                  <span className="dh2-disp-count">{count.toLocaleString("en-IN")}</span>
                  <span className="dh2-disp-pct">{Math.round(pct)}%</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="dh2-panel" aria-labelledby="dh2-cost-title">
        <header className="dh2-panel-head">
          <h3 id="dh2-cost-title" className="dh2-panel-title">
            <IndianRupee size={16} aria-hidden="true" className="dh2-ico-green" /> Cost analytics
          </h3>
          <span className="dh2-chip">₹{costAnalytics.ratePerMinute}/min</span>
        </header>
        <p className="dh2-cost-total">{formatInr(costAnalytics.totalCost)}</p>
        <p className="dh2-muted-note">Estimated cost for the selected period, based on call minutes.</p>
        {costAnalytics.byAgent.length > 0 && (
          <ul className="dh2-cost-list" aria-label="Cost by agent">
            {costAnalytics.byAgent.map((a) => (
              <li key={a.agent_id}>
                <div className="dh2-cost-row">
                  <span className="dh2-cost-name" title={a.agent_name}>{a.agent_name}</span>
                  <span className="dh2-cost-value">{formatInr(a.cost)}</span>
                </div>
                <div className="dh2-bar dh2-bar-thin" aria-hidden="true">
                  <div className="dh2-bar-fill dh2-bar-violet" style={{ width: `${share(a.cost, agentCostTotal)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dh2-panel" aria-labelledby="dh2-agent-title">
        <header className="dh2-panel-head">
          <h3 id="dh2-agent-title" className="dh2-panel-title">
            <Users size={16} aria-hidden="true" className="dh2-ico-blue" /> Agent performance
          </h3>
        </header>
        {agentBreakdown.length === 0 ? (
          <div className="dh2-empty dh2-empty-compact">
            <p className="dh2-empty-title">No agent activity yet</p>
            <p className="dh2-empty-text">Dispatch calls with a saved agent to compare performance.</p>
          </div>
        ) : (
          <div className="dh2-table-scroll">
            <table className="dh2-table">
              <thead>
                <tr>
                  <th scope="col">Agent</th>
                  <th scope="col" className="num">Calls</th>
                  <th scope="col" className="num">Completed</th>
                  <th scope="col">Pickup rate</th>
                  <th scope="col" className="num">Avg duration</th>
                </tr>
              </thead>
              <tbody>
                {agentBreakdown.map((a) => (
                  <tr key={a.agent_id}>
                    <td className="strong">{a.agent_name}</td>
                    <td className="num">{a.total.toLocaleString("en-IN")}</td>
                    <td className="num">{a.completed.toLocaleString("en-IN")}</td>
                    <td><RateCell value={a.pickupRate} /></td>
                    <td className="num">{formatDuration(a.avgDuration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dh2-panel" aria-labelledby="dh2-camp-title">
        <header className="dh2-panel-head">
          <h3 id="dh2-camp-title" className="dh2-panel-title">
            <Megaphone size={16} aria-hidden="true" className="dh2-ico-amber" /> Campaign performance
          </h3>
        </header>
        {campaignBreakdown.length === 0 ? (
          <div className="dh2-empty dh2-empty-compact">
            <p className="dh2-empty-title">No campaigns in this period</p>
            <p className="dh2-empty-text">Bulk campaigns launched from the Calls tab show up here.</p>
          </div>
        ) : (
          <div className="dh2-table-scroll">
            <table className="dh2-table">
              <thead>
                <tr>
                  <th scope="col">Launched</th>
                  <th scope="col" className="num">Calls</th>
                  <th scope="col" className="num">Completed</th>
                  <th scope="col">Pickup rate</th>
                </tr>
              </thead>
              <tbody>
                {campaignBreakdown.map((c) => (
                  <tr key={c.campaign_id}>
                    <td className="strong">
                      {new Date(c.started_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="num">{c.total.toLocaleString("en-IN")}</td>
                    <td className="num">{c.completed.toLocaleString("en-IN")}</td>
                    <td><RateCell value={c.pickupRate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function RateCell({ value }: { value: number }) {
  const safe = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div className="dh2-rate">
      <div className="dh2-bar dh2-bar-thin" aria-hidden="true">
        <div className="dh2-bar-fill dh2-bar-ok" style={{ width: `${safe}%` }} />
      </div>
      <span>{safe}%</span>
    </div>
  );
}
