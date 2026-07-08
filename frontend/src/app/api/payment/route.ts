import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createServerSupabase } from "@/lib/supabase-server";

const PLAN_PRICES: Record<string, { amount: number; calls: number; minutes: number }> = {
  basic: { amount: 99900, calls: 200, minutes: 500 },       // ₹999 in paise
  pro: { amount: 299900, calls: 1000, minutes: 2000 },      // ₹2,999
  enterprise: { amount: 999900, calls: 10000, minutes: 20000 }, // ₹9,999
};

export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerSupabase();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await request.json();

    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json(
        { success: false, error: "Invalid plan. Choose basic, pro, or enterprise." },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { success: false, error: "Payment gateway not configured" },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const planConfig = PLAN_PRICES[plan];

    const order = await razorpay.orders.create({
      amount: planConfig.amount,
      currency: "INR",
      receipt: `nova_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        user_id: user.id,
        user_email: user.email || "",
        plan: plan,
      },
    });

    return NextResponse.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      plan,
      user_email: user.email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment order failed";
    console.error("Razorpay order error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
