import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!filename) {
    return NextResponse.json({ error: "Filename required" }, { status: 400 });
  }

  // Fetch the actual file from Supabase Storage and proxy it
  const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/recordings/${filename}`;

  try {
    const res = await fetch(storageUrl);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    const contentType = res.headers.get("content-type");

    // If Supabase returned JSON (error / file not found), reject
    if (contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    const audioData = await res.arrayBuffer();
    const downloadName = filename.replace(/\.ogg$/, ".mp3");
    const isDownload = request.nextUrl.searchParams.get("download") === "1";

    const headers: Record<string, string> = {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioData.byteLength),
      "Cache-Control": "public, max-age=86400",
    };

    if (isDownload) {
      headers["Content-Disposition"] = `attachment; filename="${downloadName}"`;
    }

    return new NextResponse(audioData, { status: 200, headers });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch recording" },
      { status: 500 }
    );
  }
}
