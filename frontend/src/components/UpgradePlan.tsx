"use client";

import { useState } from "react";

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
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

const PLANS = [
  { id: "basic", name: "Basic", price: "₹999", calls: 200, minutes: 500 },
  { id: "pro", name: "Pro", price: "₹2,999", calls: 1000, minutes: 2000, popular: true },
  { id: "enterprise", name: "Enterprise", price: "₹9,999", calls: 10000, minutes: 20000 },
];

export default function UpgradePlan({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePayment = async (planId: string) => {
    setLoading(planId);
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Create order
      const orderRes = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      const orderData = await orderRes.json();
      if (!orderData.success) {
        setError(orderData.error || "Failed to create order");
        setLoading(null);
        return;
      }

      // Step 2: Open Razorpay checkout
      if (!window.Razorpay) {
        setError("Payment gateway is loading. Please try again.");
        setLoading(null);
        return;
      }

      const options: RazorpayOptions = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Nova AI",
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan - Monthly`,
        order_id: orderData.order_id,
        prefill: { email: orderData.user_email || "" },
        theme: { color: "#3b82f6" },
        handler: async (response: RazorpayResponse) => {
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
              setSuccess("Payment successful! Your plan is now active.");
              onSuccess?.();
            } else {
              setError(verifyData.error || "Payment verification failed");
            }
          } catch {
            setError("Payment received but verification failed. Contact support.");
          }
          setLoading(null);
        },
        modal: {
          ondismiss: () => {
            setLoading(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  };

  return (
    <div className="upgrade-section">
      <div className="upgrade-header">
        <h3 className="upgrade-title">Choose a Plan</h3>
        <p className="upgrade-subtitle">Subscribe to start making AI calls</p>
      </div>

      {error && (
        <div className="upgrade-alert upgrade-alert-error">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="upgrade-alert upgrade-alert-success">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>{success}</span>
        </div>
      )}

      <div className="upgrade-plans">
        {PLANS.map((plan) => (
          <div key={plan.id} className={`upgrade-plan-card ${plan.popular ? "popular" : ""}`}>
            {plan.popular && <div className="upgrade-popular-badge">Most Popular</div>}
            <div className="upgrade-plan-name">{plan.name}</div>
            <div className="upgrade-plan-price">
              <span className="upgrade-price-amount">{plan.price}</span>
              <span className="upgrade-price-period">/month</span>
            </div>
            <div className="upgrade-plan-limits">
              <span>{plan.calls.toLocaleString()} calls</span>
              <span>{plan.minutes.toLocaleString()} minutes</span>
            </div>
            <button
              onClick={() => handlePayment(plan.id)}
              disabled={loading !== null}
              className={`upgrade-pay-btn ${plan.popular ? "primary" : ""}`}
            >
              {loading === plan.id ? (
                <span className="flex items-center gap-2">
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
                  Processing...
                </span>
              ) : (
                `Subscribe — ${plan.price}`
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
