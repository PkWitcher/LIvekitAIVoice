-- Saved Prompts — stores user-generated call scripts
CREATE TABLE IF NOT EXISTS saved_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  starred BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_id ON saved_prompts(user_id);

-- RLS policies
ALTER TABLE saved_prompts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own prompts
CREATE POLICY "Users can view own prompts" ON saved_prompts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own prompts
CREATE POLICY "Users can insert own prompts" ON saved_prompts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own prompts
CREATE POLICY "Users can update own prompts" ON saved_prompts
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own prompts
CREATE POLICY "Users can delete own prompts" ON saved_prompts
  FOR DELETE USING (auth.uid() = user_id);
