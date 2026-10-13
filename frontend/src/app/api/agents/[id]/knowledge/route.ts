import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { chunkText, embedTexts, extractTextFromFile, extractTextFromUrl } from "@/lib/knowledgeBase";

const MAX_CHUNKS_PER_DOCUMENT = 300; // guardrail against runaway embedding costs on huge uploads

async function assertAgentOwnership(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  agentId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .eq("user_id", userId)
    .single();
  return !error && !!data;
}

// GET — list knowledge base documents attached to this agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!(await assertAgentOwnership(supabase, id, user.id))) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("knowledge_base_documents")
      .select("id, title, source_type, source_url, chunk_count, created_at")
      .eq("agent_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, documents: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

// POST — add a document to the agent's knowledge base: file upload (txt/pdf/docx), a URL, or pasted text
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!(await assertAgentOwnership(supabase, id, user.id))) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    let title = "";
    let sourceType: "txt" | "pdf" | "docx" | "url" | "text" = "text";
    let sourceUrl: string | null = null;
    let rawText = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.toLowerCase().split(".").pop() ?? "txt";
      sourceType = (ext === "pdf" || ext === "docx" ? ext : "txt") as "txt" | "pdf" | "docx";
      title = (form.get("title") as string | null)?.trim() || file.name;
      rawText = await extractTextFromFile(buffer, file.name);
    } else {
      const body = await request.json();
      if (body.url) {
        sourceType = "url";
        sourceUrl = body.url;
        title = (body.title as string | undefined)?.trim() || body.url;
        rawText = await extractTextFromUrl(body.url);
      } else if (body.text) {
        sourceType = "text";
        title = (body.title as string | undefined)?.trim() || "Pasted text";
        rawText = body.text;
      } else {
        return NextResponse.json(
          { success: false, error: "Provide a file, url, or text" },
          { status: 400 }
        );
      }
    }

    if (!rawText.trim()) {
      return NextResponse.json({ success: false, error: "No extractable text found" }, { status: 400 });
    }

    let chunks = chunkText(rawText);
    if (chunks.length === 0) {
      return NextResponse.json({ success: false, error: "No extractable text found" }, { status: 400 });
    }
    if (chunks.length > MAX_CHUNKS_PER_DOCUMENT) {
      chunks = chunks.slice(0, MAX_CHUNKS_PER_DOCUMENT);
    }

    const embeddings = await embedTexts(chunks);

    const { data: document, error: docError } = await supabase
      .from("knowledge_base_documents")
      .insert({
        agent_id: id,
        user_id: user.id,
        title,
        source_type: sourceType,
        source_url: sourceUrl,
        chunk_count: chunks.length,
      })
      .select("id, title, source_type, source_url, chunk_count, created_at")
      .single();

    if (docError || !document) {
      return NextResponse.json({ success: false, error: docError?.message ?? "Failed to save document" }, { status: 500 });
    }

    const chunkRows = chunks.map((content, index) => ({
      document_id: document.id,
      agent_id: id,
      chunk_index: index,
      content,
      // pgvector columns accept the bracketed-literal string form over PostgREST
      embedding: `[${embeddings[index].join(",")}]`,
    }));

    const { error: chunksError } = await supabase.from("knowledge_base_chunks").insert(chunkRows);
    if (chunksError) {
      await supabase.from("knowledge_base_documents").delete().eq("id", document.id);
      return NextResponse.json({ success: false, error: chunksError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, document });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
