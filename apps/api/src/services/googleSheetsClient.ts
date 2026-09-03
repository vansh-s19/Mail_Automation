import { google } from "googleapis";
import { env, requireGoogleSheetsConfig } from "@mail-automation/config";

export async function fetchSheetRows(): Promise<string[][]> {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, SHEET_ID } =
    requireGoogleSheetsConfig();

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Env vars store the private key with literal "\n" sequences; convert back to real newlines.
    key: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: env.SHEET_RANGE,
  });

  return (response.data.values as string[][]) ?? [];
}
