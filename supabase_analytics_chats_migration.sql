CREATE TABLE IF NOT EXISTS analytics_chat_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES analytics_chat_threads(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_chat_threads_user_updated
  ON analytics_chat_threads(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_chat_messages_thread_created
  ON analytics_chat_messages(thread_id, created_at);

ALTER TABLE analytics_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own analytics threads" ON analytics_chat_threads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own analytics messages" ON analytics_chat_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM analytics_chat_threads WHERE id = thread_id AND user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM analytics_chat_threads WHERE id = thread_id AND user_id = auth.uid())
  );