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

    const audioData = await res.arrayBuffer();

    // Determine content type and build a clean download name
    const isOgg = filename.endsWith(".ogg");
    const contentType = isOgg ? "audio/ogg" : "audio/mpeg";
    const downloadName = filename.replace(/\.ogg$/, ".mp3");

    return new NextResponse(audioData, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${downloadName}"`,
        "Content-Length": String(audioData.byteLength),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch recording" },
      { status: 500 }
    );
  }
}
