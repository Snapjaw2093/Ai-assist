// Sends texts through Twilio's REST API (no SDK needed).
export type SmsResult = { sent: true } | { sent: false; reason: string };

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return { sent: false, reason: "twilio_not_configured" };
  if (!/^\+[1-9]\d{6,14}$/.test(to)) return { sent: false, reason: "invalid_phone_number" };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1500) }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? { sent: true } : { sent: false, reason: `twilio_${res.status}` };
  } catch {
    return { sent: false, reason: "twilio_unreachable" };
  }
}

export const jpNumber = () => process.env.JP_PHONE_NUMBER ?? "";
