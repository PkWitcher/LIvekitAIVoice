-- Knowledge Base — per-agent reference documents, chunked + embedded for retrieval during calls
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_base_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('txt', 'pdf', 'docx', 'url', 'text')),
  source_url TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_base_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES knowledge_base_documents(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL, -- denormalized for fast filtering during live-call search
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL, -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_documents_agent_id ON knowledge_base_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_agent_id ON knowledge_base_chunks(agent_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document_id ON knowledge_base_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON knowledge_base_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own kb documents" ON knowledge_base_documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own kb documents" ON knowledge_base_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own kb documents" ON knowledge_base_documents
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own kb chunks" ON knowledge_base_chunks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM knowledge_base_documents d WHERE d.id = knowledge_base_chunks.document_id AND d.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own kb chunks" ON knowledge_base_chunks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM knowledge_base_documents d WHERE d.id = knowledge_base_chunks.document_id AND d.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own kb chunks" ON knowledge_base_chunks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM knowledge_base_documents d WHERE d.id = knowledge_base_chunks.document_id AND d.user_id = auth.uid())
  );

-- Cosine-similarity search, called by the voice agent (service-role key, bypasses RLS) during live calls
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  p_agent_id uuid,
  match_count int DEFAULT 3
)
RETURNS TABLE (content text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT content, 1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_base_chunks
  WHERE agent_id = p_agent_id
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
