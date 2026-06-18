import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize filename — only allow alphanumeric, dash, dot, underscore
  if (!/^[\w\-.]+\.ogg$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join("/recordings", filename);

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile() || fileStat.size === 0) {
      return NextResponse.json(
        { error: "Recording not ready" },
        { status: 404 }
      );
    }

    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/ogg",
        "Content-Length": String(fileStat.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Recording not found" },
      { status: 404 }
    );
  }
}
