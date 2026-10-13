-- Agents — persistent, named, versioned AI call-agent definitions
CREATE TABLE IF NOT EXISTS agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,           -- same across all versions of one agent lineage
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  use_case TEXT NOT NULL DEFAULT 'custom', -- lead_generation | appointments | support | negotiation | collections | custom
  language TEXT NOT NULL DEFAULT 'multi',
  voice_provider TEXT NOT NULL DEFAULT 'cartesia',
  voice_id TEXT NOT NULL DEFAULT '4877b818-c7fe-4c89-b1cf-eadf8e23da72',
  llm_provider TEXT NOT NULL DEFAULT 'openai',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (temperature >= 0 AND temperature <= 1),
  first_message TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '[]',   -- [{ "name": "customer_name", "default_value": "" }, ...]
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true, -- only one current row per group_id
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_group_id ON agents(group_id);
CREATE INDEX IF NOT EXISTS idx_agents_current ON agents(user_id, is_current) WHERE is_current = true;

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agents" ON agents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agents" ON agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents" ON agents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents" ON agents
  FOR DELETE USING (auth.uid() = user_id);
