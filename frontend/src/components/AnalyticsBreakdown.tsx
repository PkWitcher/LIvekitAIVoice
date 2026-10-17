"use client";

import { BarChart3, Users, Megaphone, IndianRupee } from "lucide-react";

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
  Interested: "bg-green-500",
  Booked: "bg-emerald-500",
  "Callback Requested": "bg-blue-500",
  "Not Interested": "bg-red-400",
  "Wrong Number": "bg-amber-500",
  Voicemail: "bg-purple-400",
  "No Answer": "bg-white/20",
  "No Response": "bg-white/20",
  Other: "bg-slate-400",
};

export default function AnalyticsBreakdown({
  conversionRate,
  dispositionBreakdown,
  agentBreakdown,
  campaignBreakdown,
  costAnalytics,
}: AnalyticsBreakdownProps) {
  const dispositionEntries = Object.entries(dispositionBreakdown).sort((a, b) => b[1] - a[1]);
  const dispositionTotal = dispositionEntries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Disposition breakdown + conversion rate */}
      <div className="dash-card space-y-3">
        <div className="dash-card-header">
          <h3 className="dash-card-title flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" /> Disposition Breakdown
          </h3>
          <span className="text-xs text-[var(--color-text-muted)]">
            Conversion rate: <span className="text-green-400 font-semibold">{conversionRate}%</span>
          </span>
        </div>
        {dispositionEntries.length === 0 ? (
          <p className="dash-empty-state">No classified calls yet in this period.</p>
        ) : (
          <div className="space-y-2">
            {dispositionEntries.map(([label, count]) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 text-[var(--color-text-secondary)] truncate">{label}</span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${DISPOSITION_COLORS[label] ?? "bg-slate-400"}`}
                    style={{ width: `${dispositionTotal > 0 ? Math.round((count / dispositionTotal) * 100) : 0}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[var(--color-text-muted)]">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cost analytics */}
      <div className="dash-card space-y-3">
        <div className="dash-card-header">
          <h3 className="dash-card-title flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-green-400" /> Cost Analytics
          </h3>
          <span className="text-xs text-[var(--color-text-muted)]">₹{costAnalytics.ratePerMinute}/min</span>
        </div>
        <p className="text-2xl font-semibold text-white">₹{costAnalytics.totalCost.toLocaleString("en-IN")}</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">Estimated cost for this period, based on connected call minutes.</p>
        {costAnalytics.byAgent.length > 0 && (
          <div className="pt-2 space-y-1.5 border-t border-[var(--color-border)]">
            {costAnalytics.byAgent.map((a) => (
              <div key={a.agent_id} className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)] truncate">{a.agent_name}</span>
                <span className="text-[var(--color-text-muted)]">₹{a.cost.toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent-wise breakdown */}
      <div className="dash-card space-y-3">
        <h3 className="dash-card-title flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" /> Agent Performance
        </h3>
        {agentBreakdown.length === 0 ? (
          <p className="dash-empty-state">No calls dispatched with a saved Agent yet.</p>
        ) : (
          <div className="dash-table-wrap dash-table-wrap-scroll-5">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Calls</th>
                  <th>Pickup Rate</th>
                  <th>Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {agentBreakdown.map((a) => (
                  <tr key={a.agent_id}>
                    <td className="dash-table-phone">{a.agent_name}</td>
                    <td className="dash-table-muted">{a.total}</td>
                    <td className="dash-table-muted">{a.pickupRate}%</td>
                    <td className="dash-table-muted">{a.avgDuration}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Campaign-wise breakdown */}
      <div className="dash-card space-y-3">
        <h3 className="dash-card-title flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-amber-400" /> Campaign Performance
        </h3>
        {campaignBreakdown.length === 0 ? (
          <p className="dash-empty-state">No bulk campaigns launched yet in this period.</p>
        ) : (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Launched</th>
                  <th>Calls</th>
                  <th>Pickup Rate</th>
                </tr>
              </thead>
              <tbody>
                {campaignBreakdown.map((c) => (
                  <tr key={c.campaign_id}>
                    <td className="dash-table-phone">{new Date(c.started_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="dash-table-muted">{c.total}</td>
                    <td className="dash-table-muted">{c.pickupRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
