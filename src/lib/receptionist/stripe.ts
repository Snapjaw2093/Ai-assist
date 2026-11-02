import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe, with no SDK: one call to create a hosted payment page, one function to verify webhooks.
export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

function siteUrl(): string | null {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL; // set by Vercel, without "https://"
  return prod ? `https://${prod}` : null;
}

/** Creates a hosted Stripe payment page for the deposit. Returns null (never throws) so a Stripe problem can't undo a booking. */
export async function createDepositCheckout(o: { jobId: string; label: string; customerName: string; amountDollars: number }): Promise<{ url: string } | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  const site = siteUrl();
  if (!key || !site || o.amountDollars <= 0) return null;
  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${site}/paid`,
    cancel_url: `${site}/paid?cancelled=1`,
    client_reference_id: o.jobId,
    "metadata[job_id]": o.jobId,
    "payment_intent_data[metadata][job_id]": o.jobId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(o.amountDollars * 100)),
    "line_items[0][price_data][product_data][name]": `Booking deposit: ${o.label}`,
    "line_items[0][price_data][product_data][description]": `Deposit for ${o.customerName}. Applied to your total.`,
  });
  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.warn("Stripe checkout failed:", res.status); return null; }
    const data = (await res.json()) as { url?: string };
    return data.url ? { url: data.url } : null;
  } catch {
    console.warn("Stripe unreachable");
    return null;
  }
}

/** Checks Stripe's signature header ("t=...,v1=...") against the raw request body. Rejects anything older than 5 minutes. */
export function verifyStripeSignature(raw: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || sigs.length === 0 || Math.abs(nowSec - Number(t)) > 300) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex"));
  return sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === want.length && timingSafeEqual(got, want);
  });
}
