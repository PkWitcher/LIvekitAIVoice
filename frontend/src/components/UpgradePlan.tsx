"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Info,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { email: string };
  theme: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on?: (event: string, callback: (response: RazorpayFailure) => void) => void;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error?: { description?: string; reason?: string };
}

export interface SubscriptionInfo {
  plan: string;
  status: string;
  max_calls_per_month: number;
  calls_used: number;
  max_minutes_per_month: number;
  minutes_used: number;
  started_at?: string | null;
  expires_at?: string | null;
}

export type UsageTone = "ok" | "warn" | "crit";
export type EffectiveStatus = "none" | "active" | "trial" | "expired" | "cancelled";

export interface SubscriptionSummary {
  hasRecord: boolean;
  plan: string;
  planLabel: string;
  status: EffectiveStatus;
  isLive: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
  callsUsed: number;
  callsMax: number;
  minutesUsed: number;
  minutesMax: number;
  callPct: number;
  minutePct: number;
  callTone: UsageTone;
  minuteTone: UsageTone;
  peakPct: number;
  peakTone: UsageTone;
  renewalLabel: string;
  renewalTone: "" | "warn" | "crit";
  expiringSoon: boolean;
}

const DAY_MS = 86_400_000;
export const WARN_PERCENT = 70;
export const NEAR_LIMIT_PERCENT = 90;
export const EXPIRING_SOON_DAYS = 7;

export function usageTone(percent: number): UsageTone {
  if (percent >= NEAR_LIMIT_PERCENT) return "crit";
  if (percent >= WARN_PERCENT) return "warn";
  return "ok";
}

function percentOf(used: number, max: number) {
  if (!Number.isFinite(used) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / max) * 100)));
}

export function formatDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function summarizeSubscription(sub: SubscriptionInfo | null, now: number = Date.now()): SubscriptionSummary {
  if (!sub) {
    return {
      hasRecord: false, plan: "", planLabel: "No plan", status: "none", isLive: false,
      startedAt: null, expiresAt: null, daysLeft: null,
      callsUsed: 0, callsMax: 0, minutesUsed: 0, minutesMax: 0,
      callPct: 0, minutePct: 0, callTone: "ok", minuteTone: "ok", peakPct: 0, peakTone: "ok",
      renewalLabel: "No active subscription", renewalTone: "", expiringSoon: false,
    };
  }

  const expiresMs = sub.expires_at ? new Date(sub.expires_at).getTime() : NaN;
  const hasExpiry = Number.isFinite(expiresMs);
  const live = sub.status === "active" || sub.status === "trial";
  const status: EffectiveStatus =
    live && hasExpiry && expiresMs < now ? "expired"
      : sub.status === "active" || sub.status === "trial" || sub.status === "expired" || sub.status === "cancelled"
        ? sub.status
        : "none";
  const isLive = status === "active" || status === "trial";
  const daysLeft = hasExpiry ? Math.ceil((expiresMs - now) / DAY_MS) : null;

  const callPct = percentOf(sub.calls_used, sub.max_calls_per_month);
  const minutePct = percentOf(sub.minutes_used, sub.max_minutes_per_month);
  const peakPct = Math.max(callPct, minutePct);

  let renewalLabel = "No expiry date";
  let renewalTone: "" | "warn" | "crit" = "";
  if (status === "cancelled") {
    renewalLabel = "Subscription cancelled";
  } else if (hasExpiry && daysLeft !== null) {
    if (expiresMs < now) {
      const ago = Math.max(1, Math.floor((now - expiresMs) / DAY_MS));
      renewalLabel = `Expired ${ago} day${ago === 1 ? "" : "s"} ago`;
      renewalTone = "crit";
    } else if (expiresMs - now < DAY_MS) {
      renewalLabel = "Expires in less than a day";
      renewalTone = "crit";
    } else {
      renewalLabel = `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
      renewalTone = daysLeft <= EXPIRING_SOON_DAYS ? "warn" : "";
    }
  }

  return {
    hasRecord: true,
    plan: sub.plan,
    planLabel: capitalize(sub.plan),
    status,
    isLive,
    startedAt: sub.started_at ?? null,
    expiresAt: sub.expires_at ?? null,
    daysLeft,
    callsUsed: sub.calls_used,
    callsMax: sub.max_calls_per_month,
    minutesUsed: sub.minutes_used,
    minutesMax: sub.max_minutes_per_month,
    callPct,
    minutePct,
    callTone: usageTone(callPct),
    minuteTone: usageTone(minutePct),
    peakPct,
    peakTone: usageTone(peakPct),
    renewalLabel,
    renewalTone,
    expiringSoon: isLive && renewalTone !== "",
  };
}

interface PlanDefinition {
  id: string;
  name: string;
  price: number;
  calls: number;
  minutes: number;
  tagline: string;
  purchasable: boolean;
  popular?: boolean;
}

const PLANS: PlanDefinition[] = [
  { id: "free", name: "Free", price: 0, calls: 50, minutes: 100, tagline: "Try the platform with a small allowance.", purchasable: false },
  { id: "basic", name: "Basic", price: 999, calls: 200, minutes: 500, tagline: "For individuals and small campaigns.", purchasable: true },
  { id: "pro", name: "Pro", price: 2999, calls: 1000, minutes: 2000, tagline: "For growing teams running regular outreach.", purchasable: true, popular: true },
  { id: "enterprise", name: "Enterprise", price: 9999, calls: 10000, minutes: 20000, tagline: "For high-volume, always-on calling.", purchasable: true },
];

const PLAN_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2, enterprise: 3 };

type Phase = "idle" | "creating" | "checkout" | "verifying";
type Notice = { kind: "error" | "success" | "info"; title: string; message: string } | null;

const PHASE_LABEL: Record<Phase, string> = {
  idle: "",
  creating: "Creating order…",
  checkout: "Awaiting payment…",
  verifying: "Verifying…",
};

function formatPrice(price: number) {
  return price === 0 ? "₹0" : `₹${price.toLocaleString("en-IN")}`;
}

function perCall(plan: PlanDefinition) {
  if (plan.price === 0 || plan.calls === 0) return null;
  const value = plan.price / plan.calls;
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: value < 10 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

interface UpgradePlanProps {
  onSuccess?: () => void;
  subscription?: SubscriptionInfo | null;
  subscriptionLoading?: boolean;
}

export default function UpgradePlan({ onSuccess, subscription = null, subscriptionLoading = false }: UpgradePlanProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmPlan, setConfirmPlan] = useState<PlanDefinition | null>(null);
  const paymentSettled = useRef(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const summary = summarizeSubscription(subscription);
  const busy = phase !== "idle";
  const currentRank = summary.isLive ? PLAN_RANK[summary.plan] ?? -1 : -1;

  const resetFlow = () => {
    setPhase("idle");
    setActivePlan(null);
  };

  const handlePayment = async (planId: string) => {
    const planDef = PLANS.find((p) => p.id === planId);
    const planName = planDef?.name ?? planId.charAt(0).toUpperCase() + planId.slice(1);
    setConfirmPlan(null);
    setActivePlan(planId);
    setPhase("creating");
    setNotice(null);
    paymentSettled.current = false;

    try {
      // Step 1: Create order
      const orderRes = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      const orderData = await orderRes.json();
      if (!orderData.success) {
        setNotice({ kind: "error", title: "Couldn't start checkout", message: orderData.error || "Failed to create order" });
        resetFlow();
        return;
      }

      // Step 2: Open Razorpay checkout
      if (!window.Razorpay) {
        setNotice({ kind: "error", title: "Payment gateway unavailable", message: "Payment gateway is loading. Please try again." });
        resetFlow();
        return;
      }

      const options: RazorpayOptions = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Nova AI",
        description: `${planName} Plan - Monthly`,
        order_id: orderData.order_id,
        prefill: { email: orderData.user_email || "" },
        theme: { color: "#6d28d9" },
        handler: async (response: RazorpayResponse) => {
          paymentSettled.current = true;
          setPhase("verifying");
          // Step 3: Verify payment
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: planId,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setNotice({
                kind: "success",
                title: `${planName} plan activated`,
                message: "Payment successful! Your plan is now active for the next 30 days and your usage has been reset.",
              });
              onSuccess?.();
            } else {
              setNotice({
                kind: "error",
                title: "Payment verification failed",
                message: `${verifyData.error || "Payment verification failed"} Payment reference: ${response.razorpay_payment_id}.`,
              });
            }
          } catch {
            setNotice({
              kind: "error",
              title: "Payment received, verification pending",
              message: `Payment received but verification failed. Contact support with payment reference ${response.razorpay_payment_id}.`,
            });
          }
          resetFlow();
        },
        modal: {
          ondismiss: () => {
            if (paymentSettled.current) return;
            setNotice({ kind: "info", title: "Checkout closed", message: "Payment was cancelled — you have not been charged." });
            resetFlow();
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on?.("payment.failed", (failure) => {
        if (paymentSettled.current) return;
        const reason = failure?.error?.description || failure?.error?.reason || "The payment could not be completed.";
        setNotice({ kind: "error", title: "Payment failed", message: `${reason} Please try again.` });
        resetFlow();
      });
      setPhase("checkout");
      rzp.open();
    } catch {
      setNotice({ kind: "error", title: "Something went wrong", message: "Something went wrong. Please try again." });
      resetFlow();
    }
  };

  const requestPurchase = (plan: PlanDefinition) => {
    if (busy) return;
    if (summary.isLive) setConfirmPlan(plan);
    else handlePayment(plan.id);
  };

  useEffect(() => {
    if (!confirmPlan) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmPlan(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmPlan]);

  const ctaLabel = (plan: PlanDefinition) => {
    if (plan.id === summary.plan && summary.isLive) return summary.expiringSoon ? `Renew — ${formatPrice(plan.price)}` : `Renew early — ${formatPrice(plan.price)}`;
    if (summary.isLive) return PLAN_RANK[plan.id] > currentRank ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`;
    return `Subscribe — ${formatPrice(plan.price)}`;
  };

  return (
    <div className="dh2-upgrade" id="dh2-subscription">
      {subscriptionLoading ? (
        <div className="dh2-panel" aria-busy="true">
          <div className="dh2-skel dh2-skel-line" style={{ width: "40%" }} />
          <div className="dh2-skel dh2-skel-line" style={{ width: "100%", marginTop: 16 }} />
          <div className="dh2-skel dh2-skel-line" style={{ width: "100%", marginTop: 10 }} />
        </div>
      ) : (
        <SubscriptionOverview summary={summary} />
      )}

      <div className="dh2-section-head" id="dh2-plans">
        <div>
          <h3 className="dh2-section-title">Choose a plan</h3>
          <p className="dh2-section-sub">
            One-time payment per 30 days via Razorpay. Plans don&apos;t renew automatically — renew any time before expiry.
          </p>
        </div>
      </div>

      {(phase === "creating" || phase === "verifying") && (
        <div className="dh2-notice dh2-notice-info" role="status" aria-live="polite">
          <LoaderCircle className="dh2-spin" size={16} aria-hidden="true" />
          <div>
            <strong>{phase === "creating" ? "Preparing your order" : "Verifying your payment"}</strong>
            <p>
              {phase === "creating"
                ? "Setting up a secure checkout session…"
                : "Please keep this page open while we confirm your payment."}
            </p>
          </div>
        </div>
      )}

      {notice && (
        <div
          className={`dh2-notice dh2-notice-${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.kind === "error" ? <CircleAlert size={16} aria-hidden="true" /> : notice.kind === "success" ? <CheckCircle2 size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}
          <div>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>
          <button className="dh2-notice-close" onClick={() => setNotice(null)} aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="dh2-plan-grid">
        {PLANS.map((plan) => {
          const isCurrent = summary.hasRecord && summary.plan === plan.id && summary.isLive;
          const call = perCall(plan);
          const isThis = activePlan === plan.id && busy;
          return (
            <article
              key={plan.id}
              className={`dh2-plan-card ${plan.popular ? "popular" : ""} ${isCurrent ? "current" : ""}`}
              aria-label={`${plan.name} plan`}
            >
              <div className="dh2-plan-badges">
                {plan.popular && <span className="dh2-plan-flag popular"><Sparkles size={11} aria-hidden="true" /> Most popular</span>}
                {isCurrent && <span className="dh2-plan-flag current"><Check size={11} aria-hidden="true" /> Current plan</span>}
              </div>
              <h4 className="dh2-plan-name">{plan.name}</h4>
              <p className="dh2-plan-tagline">{plan.tagline}</p>
              <div className="dh2-plan-price">
                <span className="dh2-plan-amount">{formatPrice(plan.price)}</span>
                <span className="dh2-plan-period">{plan.price === 0 ? "free" : "/ month"}</span>
              </div>
              <ul className="dh2-plan-features">
                <li><Check size={14} aria-hidden="true" /><span><strong>{plan.calls.toLocaleString("en-IN")}</strong> calls / month</span></li>
                <li><Check size={14} aria-hidden="true" /><span><strong>{plan.minutes.toLocaleString("en-IN")}</strong> minutes / month</span></li>
                {call && <li><Check size={14} aria-hidden="true" /><span>≈ {call} per call at full usage</span></li>}
                <li><Check size={14} aria-hidden="true" /><span>{plan.purchasable ? "Valid for 30 days per payment" : "Assigned by your administrator"}</span></li>
              </ul>
              {plan.purchasable ? (
                <button
                  className={`dh2-btn ${plan.popular ? "dh2-btn-primary" : "dh2-btn-secondary"} dh2-btn-block`}
                  onClick={() => requestPurchase(plan)}
                  disabled={busy}
                  aria-label={`${ctaLabel(plan)} — ${plan.name} plan`}
                >
                  {isThis ? (
                    <>
                      <LoaderCircle className="dh2-spin" size={14} aria-hidden="true" />
                      {PHASE_LABEL[phase]}
                    </>
                  ) : (
                    <>
                      <CreditCard size={14} aria-hidden="true" />
                      {ctaLabel(plan)}
                    </>
                  )}
                </button>
              ) : (
                <button className="dh2-btn dh2-btn-secondary dh2-btn-block" disabled>
                  {isCurrent ? "Your current plan" : "Contact admin to assign"}
                </button>
              )}
            </article>
          );
        })}
      </div>

      <p className="dh2-plan-foot">
        <ShieldCheck size={14} aria-hidden="true" /> Payments are processed securely by Razorpay. Prices are in INR.
      </p>

      {confirmPlan && (
        <div className="dh2-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmPlan(null); }}>
          <div className="dh2-modal" role="dialog" aria-modal="true" aria-labelledby="dh2-confirm-title">
            <h4 id="dh2-confirm-title" className="dh2-modal-title">
              {confirmPlan.id === summary.plan ? `Renew ${confirmPlan.name}?` : `Switch to ${confirmPlan.name}?`}
            </h4>
            <p className="dh2-modal-text">
              You currently have the <strong>{summary.planLabel}</strong> plan. Paying now will:
            </p>
            <ul className="dh2-modal-list">
              <li>Activate <strong>{confirmPlan.name}</strong> immediately for 30 days from today.</li>
              <li>Reset your calls and minutes used to zero — unused allowance doesn&apos;t carry over.</li>
              <li>Charge {formatPrice(confirmPlan.price)} once; there is no automatic renewal.</li>
            </ul>
            <div className="dh2-modal-actions">
              <button className="dh2-btn dh2-btn-secondary" onClick={() => setConfirmPlan(null)}>Cancel</button>
              <button ref={confirmBtnRef} className="dh2-btn dh2-btn-primary" onClick={() => handlePayment(confirmPlan.id)}>
                <CreditCard size={14} aria-hidden="true" /> Pay {formatPrice(confirmPlan.price)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubscriptionOverview({ summary }: { summary: SubscriptionSummary }) {
  if (!summary.hasRecord) {
    return (
      <section className="dh2-panel dh2-sub-summary" aria-label="Current subscription">
        <div className="dh2-sub-top">
          <div>
            <p className="dh2-eyebrow">Current subscription</p>
            <h3 className="dh2-section-title">No active plan</h3>
            <p className="dh2-section-sub">Choose a plan below to start placing AI calls.</p>
          </div>
          <span className="dh2-pill dh2-status-none"><span className="dh2-pill-dot" />No plan</span>
        </div>
      </section>
    );
  }

  const attention =
    summary.status === "expired" ? { tone: "crit", text: "Your plan has expired. Renew below to resume calling." }
      : summary.status === "cancelled" ? { tone: "crit", text: "This subscription was cancelled. Choose a plan below to reactivate." }
        : summary.expiringSoon ? { tone: summary.renewalTone || "warn", text: `Your plan is ending soon (${summary.renewalLabel.toLowerCase()}). Renew to avoid interruption.` }
          : summary.peakTone !== "ok" ? { tone: summary.peakTone, text: summary.peakTone === "crit" ? "You're almost out of allowance. Upgrade to avoid blocked calls." : "You've used most of your allowance this period." }
            : null;

  return (
    <section className="dh2-panel dh2-sub-summary" aria-label="Current subscription">
      <div className="dh2-sub-top">
        <div>
          <p className="dh2-eyebrow">Current subscription</p>
          <div className="dh2-sub-title-row">
            <h3 className="dh2-section-title">{summary.planLabel} plan</h3>
            <span className={`dh2-pill dh2-plan-${summary.plan}`}>{summary.planLabel}</span>
            <span className={`dh2-pill dh2-status-${summary.status}`}><span className="dh2-pill-dot" />{summary.status}</span>
          </div>
        </div>
        <div className="dh2-sub-renewal">
          <CalendarClock size={16} aria-hidden="true" />
          <div>
            <span className={`dh2-sub-renewal-main ${summary.renewalTone}`}>{summary.renewalLabel}</span>
            <span className="dh2-sub-renewal-sub">
              {summary.expiresAt ? `${summary.status === "expired" ? "Ended" : "Ends"} ${formatDateShort(summary.expiresAt)}` : `Since ${formatDateShort(summary.startedAt)}`}
            </span>
          </div>
        </div>
      </div>

      <div className="dh2-usage-grid">
        <UsageBar label="Calls" used={summary.callsUsed} max={summary.callsMax} pct={summary.callPct} tone={summary.callTone} />
        <UsageBar label="Minutes" used={Math.round(summary.minutesUsed)} max={summary.minutesMax} pct={summary.minutePct} tone={summary.minuteTone} />
      </div>

      {attention && (
        <div className={`dh2-callout dh2-callout-${attention.tone}`} role="status">
          <CircleAlert size={15} aria-hidden="true" />
          <span>{attention.text}</span>
        </div>
      )}
    </section>
  );
}

export function UsageBar({ label, used, max, pct, tone }: { label: string; used: number; max: number; pct: number; tone: UsageTone }) {
  return (
    <div className="dh2-usage">
      <div className="dh2-usage-top">
        <span className="dh2-usage-label">{label}</span>
        <span className="dh2-usage-value">
          {used.toLocaleString("en-IN")} <span>/ {max.toLocaleString("en-IN")}</span>
          <em className={`dh2-usage-pct dh2-tone-${tone}`}>{pct}%</em>
        </span>
      </div>
      <div className="dh2-bar" role="progressbar" aria-label={`${label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className={`dh2-bar-fill dh2-bar-${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
