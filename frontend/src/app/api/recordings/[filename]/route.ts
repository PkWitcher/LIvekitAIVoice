import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!filename) {
    return NextResponse.json({ error: "Filename required" }, { status: 400 });
  }

  // Redirect to Supabase Storage public URL
  const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/recordings/${filename}`;
  
  return NextResponse.redirect(storageUrl, 302);
}
