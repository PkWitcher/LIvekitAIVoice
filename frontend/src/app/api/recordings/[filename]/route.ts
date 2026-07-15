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

  // Fetch the actual file from Supabase Storage — try both bucket names
  const urls = [
    `${SUPABASE_URL}/storage/v1/object/public/recording/${filename}`,
    `${SUPABASE_URL}/storage/v1/object/public/recordings/${filename}`,
  ];

  try {
    let audioData: ArrayBuffer | null = null;

    for (const storageUrl of urls) {
      const res = await fetch(storageUrl);
      if (!res.ok) continue;

      const ct = res.headers.get("content-type");
      if (ct?.includes("application/json")) continue;

      audioData = await res.arrayBuffer();
      if (audioData.byteLength > 0) break;
      audioData = null;
    }

    if (!audioData) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }
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
