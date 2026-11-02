import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isTool, run, schemas } from "@/lib/receptionist/tools";

export const maxDuration = 30;

// The "back office" for the Retell phone agent. Retell calls POST /api/receptionist/<tool>
// with { name, args, call } and sends our shared secret as "Authorization: Bearer ...".
function authorized(header: string | null): boolean {
  const secret = process.env.RECEPTIONIST_SECRET;
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function failureCode(err: unknown): string {
  const m = err instanceof Error ? err.message : "";
  if (m.includes("GOOGLE_SERVICE_ACCOUNT_JSON is not set")) return "google_key_missing_in_vercel";
  if (m.includes("GOOGLE_CALENDAR_ID is not set")) return "calendar_id_missing_in_vercel";
  if (err instanceof SyntaxError) return "google_key_is_not_valid_json";
  if (/DECODER|PEM|private key/i.test(m)) return "google_key_private_key_unreadable";
  if (m.includes("Google auth failed")) return "google_rejected_the_key";
  if (m.includes("Google Calendar error 404")) return "calendar_not_found_check_id_and_sharing";
  if (m.includes("Google Calendar error 403")) return "calendar_api_off_or_not_shared_with_robot";
  if (m.includes("Redis")) return "database_error";
  return "unknown";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ tool: string }> }) {
  if (!authorized(req.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tool } = await ctx.params;
  if (!isTool(tool)) return NextResponse.json({ error: "Unknown tool" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { args?: Record<string, unknown>; call?: { from_number?: string } };
  const args = { ...(body.args ?? {}) };
  // Retell tells us who is calling; use it when the caller didn't read out a number.
  if ((tool === "book_job" || tool === "text_jp") && !args.customer_phone && body.call?.from_number) args.customer_phone = body.call.from_number;

  try {
    return NextResponse.json(await run(tool, args));
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") return NextResponse.json({ error: "Invalid arguments", detail: schemas[tool] && err.message.slice(0, 300) }, { status: 400 });
    console.error(`Receptionist ${tool} failed:`, err);
    // Retell reads this aloud-ish: keep it plain so the agent can recover gracefully.
    // `code` names the broken piece for whoever is setting this up. It never includes any secret text.
    return NextResponse.json({ error: "Something went wrong. Offer to have JP call the customer back.", code: failureCode(err) }, { status: 500 });
  }
}
