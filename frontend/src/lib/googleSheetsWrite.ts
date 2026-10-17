// Writes call outcomes (Interested / Appointment Date / Call Summary / Disposition) back
// into the user's Google Sheet after each call. Uses a Google service account (JWT ->
// OAuth2 access token -> plain REST calls) instead of the googleapis SDK, consistent with
// the rest of this codebase's lightweight fetch-based integrations (no new dependency).
import crypto from "crypto";

const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
// Private keys are usually stored in env vars with literal "\n" — convert back to real newlines
const SERVICE_ACCOUNT_PRIVATE_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

const SHEET_URL_PATTERN = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
const GID_PATTERN = /[?&#]gid=(\d+)/;

const WRITEBACK_COLUMNS = ["Interested", "Appointment Date", "Call Summary", "Disposition"] as const;

export interface CallResultForSheet {
  interested?: string | null;
  appointmentDate?: string | null;
  summary?: string | null;
  disposition?: string | null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(): Promise<string | null> {
  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: SERVICE_ACCOUNT_EMAIL,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const signInput = `${header}.${claims}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signInput);
  signer.end();
  const signature = base64url(signer.sign(SERVICE_ACCOUNT_PRIVATE_KEY));
  const jwt = `${signInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Compare by last 10 digits so "+917274843474", "917274843474" and "7274843474" all match
function normalizeDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/**
 * Finds the row matching `phoneNumber` in the Google Sheet and writes the call outcome
 * into Interested/Appointment Date/Call Summary/Disposition columns (added if missing).
 * Best-effort: any failure (missing credentials, number not found, API error) is logged
 * and swallowed so a sheet problem never breaks call processing.
 */
export async function writeCallResultToSheet(
  sheetUrl: string,
  phoneNumber: string,
  result: CallResultForSheet
): Promise<void> {
  try {
    const match = sheetUrl.match(SHEET_URL_PATTERN);
    if (!match) return;
    const sheetId = match[1];
    const gid = sheetUrl.match(GID_PATTERN)?.[1] ?? "0";

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn("[SHEETS] Write-back skipped — GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY not configured");
      return;
    }
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    // Sheets API addresses ranges by tab title, not gid — map gid -> title first
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties(sheetId,title))`,
      { headers: authHeaders }
    );
    if (!metaRes.ok) {
      console.warn("[SHEETS] Could not read spreadsheet metadata:", await metaRes.text());
      return;
    }
    const meta = await metaRes.json();
    const sheetProps =
      meta.sheets?.find((s: { properties: { sheetId: number } }) => String(s.properties.sheetId) === gid)
        ?.properties ?? meta.sheets?.[0]?.properties;
    const sheetTitle: string = sheetProps?.title ?? "Sheet1";
    const encodedTitle = encodeURIComponent(sheetTitle);

    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedTitle}`,
      { headers: authHeaders }
    );
    if (!dataRes.ok) {
      console.warn("[SHEETS] Could not read sheet values:", await dataRes.text());
      return;
    }
    const dataJson = await dataRes.json();
    const rows: string[][] = dataJson.values ?? [];
    if (rows.length === 0) return;

    const headerRow = rows[0];
    const normalizedTarget = normalizeDigits(phoneNumber);

    let phoneColIndex = headerRow.findIndex((h) => /phone|mobile|number|contact/i.test(h ?? ""));
    if (phoneColIndex === -1) phoneColIndex = 0;

    let targetRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const cell = rows[i]?.[phoneColIndex];
      if (cell && normalizeDigits(cell) === normalizedTarget) {
        targetRowIndex = i;
        break;
      }
    }
    if (targetRowIndex === -1) {
      console.warn(`[SHEETS] Phone number ${phoneNumber} not found in sheet — skipping write-back`);
      return;
    }

    // Ensure the 4 result columns exist, appending any that are missing to the header row
    const colIndexByName = new Map<string, number>();
    headerRow.forEach((h, i) => colIndexByName.set((h ?? "").trim(), i));
    const missing = WRITEBACK_COLUMNS.filter((c) => !colIndexByName.has(c));
    if (missing.length > 0) {
      const newHeader = [...headerRow];
      missing.forEach((c) => {
        colIndexByName.set(c, newHeader.length);
        newHeader.push(c);
      });
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedTitle}!1:1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [newHeader] }),
        }
      );
    }

    const values = [result.interested ?? "", result.appointmentDate ?? "", result.summary ?? "", result.disposition ?? ""];
    const data = WRITEBACK_COLUMNS.map((col, i) => ({
      range: `${encodedTitle}!${columnLetter(colIndexByName.get(col)!)}${targetRowIndex + 1}`,
      values: [[values[i]]],
    }));

    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });
    if (!updateRes.ok) {
      console.warn("[SHEETS] Write-back update failed:", await updateRes.text());
    }
  } catch (err) {
    console.warn("[SHEETS] Write-back failed:", err);
  }
}
