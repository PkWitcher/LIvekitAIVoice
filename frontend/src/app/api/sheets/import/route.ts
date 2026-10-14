import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { parseCsvText } from "@/lib/phoneListParser";

// Only accept real Google Sheets links; the sheet ID is used to rebuild our own fetch URL
// below (rather than fetching the user-supplied URL verbatim) to prevent SSRF.
const SHEET_URL_PATTERN = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
const GID_PATTERN = /[?&#]gid=(\d+)/;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_ROWS = 2000;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const sheetUrl = typeof body?.sheet_url === "string" ? body.sheet_url.trim() : "";
    if (!sheetUrl) {
      return NextResponse.json({ success: false, error: "sheet_url is required" }, { status: 400 });
    }

    const match = sheetUrl.match(SHEET_URL_PATTERN);
    if (!match) {
      return NextResponse.json(
        {
          success: false,
          error: "That doesn't look like a Google Sheets link (https://docs.google.com/spreadsheets/d/...)",
        },
        { status: 400 }
      );
    }

    const sheetId = match[1];
    const gid = sheetUrl.match(GID_PATTERN)?.[1] ?? "0";
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(exportUrl, { signal: controller.signal, redirect: "follow" });
    } catch {
      return NextResponse.json(
        { success: false, error: "Could not reach Google Sheets. Check the link and try again." },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not access this sheet. Make sure it's shared as \"Anyone with the link can view\".",
        },
        { status: 400 }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const csvText = await response.text();

    // Private/unshared sheets redirect to an HTML sign-in page instead of returning CSV
    if (contentType.includes("text/html") || csvText.trim().startsWith("<")) {
      return NextResponse.json(
        {
          success: false,
          error: "This sheet isn't publicly accessible. Share it as \"Anyone with the link can view\" and try again.",
        },
        { status: 400 }
      );
    }

    const { headers, rows } = parseCsvText(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "This sheet has no data rows" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      headers,
      rows: rows.slice(0, MAX_ROWS),
      truncated: rows.length > MAX_ROWS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
