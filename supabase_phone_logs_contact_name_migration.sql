-- Adds a contact_name column so we can personalize post-call WhatsApp messages
-- (e.g. "Hi Rahul" instead of "Hi there") using the name collected from bulk
-- dial contacts (sheet/CSV import) or the manual "name" variable on single calls.

ALTER TABLE phone_logs ADD COLUMN IF NOT EXISTS contact_name TEXT;
