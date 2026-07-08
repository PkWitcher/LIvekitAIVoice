import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabase } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

const PLAN_CONFIG: Record<string, { calls: number; minutes: number; amount: number }> = {
  basic: { calls: 200, minutes: 500, amount: 99900 },
  pro: { calls: 1000, minutes: 2000, amount: 299900 },
  enterprise: { calls: 10000, minutes: 20000, amount: 999900 },
};

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerSupabase();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
    } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
      return NextResponse.json(
        { success: false, error: "Missing payment details" },
        { status: 400 }
      );
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json(
        { success: false, error: "Payment gateway not configured" },
        { status: 500 }
      );
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, error: "Payment verification failed. Invalid signature." },
        { status: 400 }
      );
    }

    // Payment verified — activate/update subscription
    const planConfig = PLAN_CONFIG[plan];
    if (!planConfig) {
      return NextResponse.json(
        { success: false, error: "Invalid plan" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database not configured" },
        { status: 500 }
      );
    }

    // Calculate expiry (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Upsert subscription
    const { error: dbError } = await supabase
      .from("user_subscriptions")
      .upsert({
        user_id: user.id,
        plan,
        status: "active",
        max_calls_per_month: planConfig.calls,
        calls_used: 0,
        max_minutes_per_month: planConfig.minutes,
        minutes_used: 0,
        amount_cents: planConfig.amount,
        currency: "INR",
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: "user_id" });

    if (dbError) {
      console.error("Subscription update error:", dbError);
      return NextResponse.json(
        { success: false, error: "Payment received but subscription update failed. Contact support." },
        { status: 500 }
      );
    }

    // Log payment
    await supabase.from("payment_logs").insert({
      user_id: user.id,
      razorpay_order_id,
      razorpay_payment_id,
      plan,
      amount_paise: planConfig.amount,
      currency: "INR",
      status: "captured",
    }).then();

    return NextResponse.json({
      success: true,
      message: "Payment verified! Your subscription is now active.",
      plan,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    console.error("Payment verify error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
