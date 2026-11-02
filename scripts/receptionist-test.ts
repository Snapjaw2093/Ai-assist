import assert from "node:assert/strict";
import { zonedToDate, weekdayOf, addDays } from "../src/lib/receptionist/time";
import { run, isTool } from "../src/lib/receptionist/tools";

// 9am New York: EST (UTC-5) in November, EDT (UTC-4) in July, across the DST switch.
assert.equal(zonedToDate("2026-11-03", "09:00", "America/New_York").toISOString(), "2026-11-03T14:00:00.000Z");
assert.equal(zonedToDate("2026-07-01", "09:00", "America/New_York").toISOString(), "2026-07-01T13:00:00.000Z");
assert.equal(weekdayOf("2026-11-01"), 0);
assert.equal(addDays("2026-12-31", 1), "2027-01-01");
assert.equal(isTool("book_job"), true);
assert.equal(isTool("nope"), false);

(async () => {
  const q = await run("quote_price", { service: "interior" });
  assert.equal(q.price_dollars, 75);
  const q3 = await run("quote_price", { service: "stage3" });
  assert.deepEqual([q3.price_dollars, q3.starting_at, q3.deposit_dollars], [750, true, 50]);
  await assert.rejects(run("quote_price", { service: "bogus" }));
  console.log("receptionist offline tests passed");
})();

// CRM store (in-memory backend)
import { saveJob, listJobs, setJobStatus, saveCall, listCalls, listCustomers } from "../src/lib/crm/store";
(async () => {
  await saveJob({ id: "j1", createdAt: 1, startsAt: "2026-11-05T15:00:00.000Z", endsAt: "2026-11-05T16:00:00.000Z", serviceLabel: "Standard", price: 120, vehicle: "Truck", vehicleSize: "truck", locationType: "garage", address: "1 Main St", customerName: "Sam", customerPhone: "+15551230000", status: "scheduled" });
  await setJobStatus("j1", "completed");
  await saveCall({ id: "c1", at: 5, fromNumber: "+15551230000" });
  await saveCall({ id: "c1", at: 5, summary: "Booked a job" }); // second event merges into the first
  assert.equal((await listJobs())[0].status, "completed");
  assert.equal((await listCalls()).length, 1);
  assert.equal((await listCalls())[0].summary, "Booked a job");
  const [cust] = await listCustomers();
  assert.deepEqual([cust.name, cust.jobs, cust.spent, cust.calls], ["Sam", 1, 120, 1]);
  console.log("crm store tests passed");
})();

// Spoken dates and times
import { parseSpokenDate, parseTimeOfDay } from "../src/lib/receptionist/time";
const T = "2026-11-02"; // a Monday
const d = (x: string) => parseSpokenDate(x, T)?.date;
assert.equal(d("2026-11-26"), "2026-11-26");
assert.equal(d("11/26/2026"), "2026-11-26");
assert.equal(d("tomorrow"), "2026-11-03");
assert.equal(d("thursday"), "2026-11-05");
assert.equal(d("Monday"), "2026-11-02");
assert.equal(d("the 5th"), "2026-11-05");
assert.equal(d("thursday the 5th"), "2026-11-05");
assert.equal(parseSpokenDate("thursday the 5th", T)?.mismatch, undefined);
assert.ok(parseSpokenDate("tuesday the 5th", T)?.mismatch); // Nov 5 is a Thursday: flag it
assert.equal(d("november 12th"), "2026-11-12");
assert.equal(d("Jan 3"), "2027-01-03");
assert.equal(d("tuesday at 3"), "2026-11-03");
assert.equal(d("blah"), undefined);
assert.equal(d("feb 30"), undefined);
for (const [t, want] of [["1030", 630], ["10:30", 630], ["10:30 am", 630], ["1pm", 780], ["130", 810], ["3", 900], ["noon", 720], ["8", 480], ["25:00", null]] as const) assert.equal(parseTimeOfDay(t), want, t);
console.log("spoken date/time tests passed");

// Stripe
import { createHmac } from "node:crypto";
import { createDepositCheckout, verifyStripeSignature } from "../src/lib/receptionist/stripe";
import { markDepositPaid } from "../src/lib/crm/store";
(async () => {
  const raw = '{"type":"checkout.session.completed"}', secret = "whsec_test", t = 1_700_000_000;
  const sig = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  assert.equal(verifyStripeSignature(raw, `t=${t},v1=${sig}`, secret, t + 10), true);
  assert.equal(verifyStripeSignature(raw + " ", `t=${t},v1=${sig}`, secret, t + 10), false, "tampered body");
  assert.equal(verifyStripeSignature(raw, `t=${t},v1=${sig}`, "other", t + 10), false, "wrong secret");
  assert.equal(verifyStripeSignature(raw, `t=${t},v1=${sig}`, secret, t + 3600), false, "too old");
  assert.equal(verifyStripeSignature(raw, null, secret, t), false);

  // the payment-link request: right amount, tied to the job, nothing sent without keys
  assert.equal(await createDepositCheckout({ jobId: "j", label: "X", customerName: "Sam", amountDollars: 50 }), null);
  process.env.STRIPE_SECRET_KEY = "sk_test_x"; process.env.SITE_URL = "https://example.com";
  const realFetch = globalThis.fetch; let seen: { url?: string; body?: string; auth?: string } = {};
  globalThis.fetch = (async (u: string, init: RequestInit) => { seen = { url: u, body: String(init.body), auth: (init.headers as Record<string, string>).Authorization }; return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/abc" }), { status: 200 }); }) as typeof fetch;
  const r = await createDepositCheckout({ jobId: "job123", label: "Interior Detail", customerName: "Sam", amountDollars: 50 });
  globalThis.fetch = realFetch;
  assert.equal(r?.url, "https://checkout.stripe.com/c/pay/abc");
  assert.equal(seen.url, "https://api.stripe.com/v1/checkout/sessions");
  assert.ok(seen.body!.includes("unit_amount%5D=5000") && seen.body!.includes("metadata%5Bjob_id%5D=job123") && seen.body!.includes("success_url=https%3A%2F%2Fexample.com%2Fpaid"));
  assert.equal(seen.auth, "Bearer sk_test_x");

  // paying flips the job to paid
  const { saveJob, listJobs } = await import("../src/lib/crm/store");
  await saveJob({ id: "dep1", createdAt: 1, startsAt: "2026-12-05T15:00:00.000Z", endsAt: "2026-12-05T16:00:00.000Z", serviceLabel: "Interior", price: 75, vehicle: "X", vehicleSize: "car", locationType: "garage", address: "a", customerName: "Dee", status: "scheduled", depositDollars: 50, depositPaid: false });
  await markDepositPaid("dep1");
  assert.equal((await listJobs()).find((j) => j.id === "dep1")?.depositPaid, true);
  console.log("stripe tests passed");
})();
