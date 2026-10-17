-- Saved Sheets — lets a user store multiple named Google Sheet links to pick from later
-- in Bulk Dialer, instead of re-pasting the URL every time.
CREATE TABLE IF NOT EXISTS saved_sheets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  sheet_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_sheets_user_id ON saved_sheets(user_id);

ALTER TABLE saved_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved sheets" ON saved_sheets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved sheets" ON saved_sheets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved sheets" ON saved_sheets
  FOR DELETE USING (auth.uid() = user_id);
