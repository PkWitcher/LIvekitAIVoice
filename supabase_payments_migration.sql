-- Payment logs table for tracking Razorpay transactions
CREATE TABLE IF NOT EXISTS payment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'captured',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id ON payment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_order_id ON payment_logs(razorpay_order_id);

ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON payment_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own payments" ON payment_logs
  FOR SELECT USING (auth.uid() = user_id);
