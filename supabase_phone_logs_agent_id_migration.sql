-- Link phone_logs to the Agent Builder agent that was used for the call (nullable — older calls have none)
ALTER TABLE phone_logs ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_phone_logs_agent_id ON phone_logs(agent_id);
