-- Analytics additions: AI-classified call disposition/summary, and a lightweight campaign grouping
-- for bulk dials (one campaign_id per /api/queue batch — no separate campaigns table needed).
ALTER TABLE phone_logs ADD COLUMN IF NOT EXISTS disposition TEXT;
ALTER TABLE phone_logs ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE phone_logs ADD COLUMN IF NOT EXISTS campaign_id UUID;

CREATE INDEX IF NOT EXISTS idx_phone_logs_disposition ON phone_logs(disposition);
CREATE INDEX IF NOT EXISTS idx_phone_logs_campaign_id ON phone_logs(campaign_id);
