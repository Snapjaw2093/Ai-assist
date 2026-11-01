import { createSign } from "node:crypto";

// Talks to Google Calendar with a service account (a robot Google account).
// Setup: create the account, download its JSON key, share JP's calendar with the robot's
// email ("Make changes to events"), then set the env vars listed in the README.
const SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

let cached: { token: string; exp: number } | null = null;

function credentials(): { email: string; key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const j = JSON.parse(raw);
  return { email: j.client_email, key: String(j.private_key).replace(/\\n/g, "\n") };
}

const b64 = (v: object | Buffer) => Buffer.from(v instanceof Buffer ? v : JSON.stringify(v)).toString("base64url");

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;
  const { email, key } = credentials();
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(key);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64(sig)}` }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Google auth failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, exp: now + data.expires_in };
  return cached.token;
}

function calendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error("GOOGLE_CALENDAR_ID is not set");
  return id;
}

async function gfetch(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Google Calendar error ${res.status}`);
  return res.json();
}

export type Busy = { start: Date; end: Date };

export async function busyBetween(from: Date, to: Date): Promise<Busy[]> {
  const data = await gfetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: calendarId() }] }),
  });
  const list = data.calendars?.[calendarId()]?.busy ?? [];
  return list.map((b: { start: string; end: string }) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export async function createEvent(e: { summary: string; description: string; location?: string; start: Date; end: Date; timeZone: string }) {
  const data = await gfetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: e.summary, description: e.description, location: e.location,
      start: { dateTime: e.start.toISOString(), timeZone: e.timeZone },
      end: { dateTime: e.end.toISOString(), timeZone: e.timeZone },
    }),
  });
  return { id: data.id as string };
}
