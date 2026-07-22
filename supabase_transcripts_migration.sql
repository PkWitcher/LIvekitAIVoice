-- Call Transcripts — stores live conversation messages per call
CREATE TABLE IF NOT EXISTS call_transcripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name TEXT NOT NULL,
  speaker TEXT NOT NULL CHECK (speaker IN ('ai', 'user')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by room
CREATE INDEX IF NOT EXISTS idx_call_transcripts_room ON call_transcripts(room_name);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE call_transcripts;

-- RLS policies
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read transcripts (needed for realtime subscription)
CREATE POLICY "Authenticated users can view transcripts" ON call_transcripts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can insert (backend agent inserts via service key)
CREATE POLICY "Service can insert transcripts" ON call_transcripts
  FOR INSERT WITH CHECK (true);
