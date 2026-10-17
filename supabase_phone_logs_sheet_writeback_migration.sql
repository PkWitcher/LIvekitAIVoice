-- Tracks which Google Sheet a call was dispatched from, and the AI-extracted call outcome,
-- so results can be written back into the sheet (Interested / Appointment Date columns).
ALTER TABLE phone_logs ADD COLUMN IF NOT EXISTS sheet_url TEXT;
ALTER TABLE phone_logs ADD COLUMN IF NOT EXISTS interested TEXT;
ALTER TABLE phone_logs ADD COLUMN IF NOT EXISTS appointment_date TEXT;
