import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { saveCall } from "@/lib/crm/store";

// Retell posts call events here. Set the agent's webhook URL to
//   https://<your-site>/api/retell/webhook?token=<RECEPTIONIST_SECRET>
function authorized(token: string | null): boolean {
  const secret = process.env.RECEPTIONIST_SECRET;
  if (!secret || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

type RetellCall = {
  call_id?: string; from_number?: string; start_timestamp?: number; end_timestamp?: number; duration_ms?: number;
  transcript?: string; recording_url?: string; disconnection_reason?: string;
  call_analysis?: { call_summary?: string; user_sentiment?: string; call_successful?: boolean };
};

export async function POST(req: NextRequest) {
  if (!authorized(req.nextUrl.searchParams.get("token"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { event?: string; call?: RetellCall } | null;
  const call = body?.call;
  if (!call?.call_id || !["call_ended", "call_analyzed"].includes(body?.event ?? "")) return NextResponse.json({ ok: true, ignored: true });

  const durationSec = call.duration_ms ? Math.round(call.duration_ms / 1000) : call.end_timestamp && call.start_timestamp ? Math.round((call.end_timestamp - call.start_timestamp) / 1000) : undefined;
  try {
    await saveCall({
      id: call.call_id, at: call.start_timestamp ?? Date.now(), fromNumber: call.from_number, durationSec,
      transcript: call.transcript, recordingUrl: call.recording_url, disconnectionReason: call.disconnection_reason,
      summary: call.call_analysis?.call_summary, sentiment: call.call_analysis?.user_sentiment, successful: call.call_analysis?.call_successful,
    });
  } catch (err) {
    console.error("Saving call failed:", err);
    return NextResponse.json({ error: "Storage error" }, { status: 500 }); // Retell will retry
  }
  return NextResponse.json({ ok: true });
}
