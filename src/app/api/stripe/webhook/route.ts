import { NextResponse, type NextRequest } from "next/server";
import { markDepositPaid } from "@/lib/crm/store";
import { verifyStripeSignature } from "@/lib/receptionist/stripe";

// Stripe calls this when a customer pays. In Stripe -> Developers -> Webhooks add:
//   https://<your-site>/api/stripe/webhook   event: checkout.session.completed
// and put its signing secret in STRIPE_WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  const raw = await req.text(); // must be the untouched body for the signature to match
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  const event = JSON.parse(raw) as { type?: string; data?: { object?: { payment_status?: string; metadata?: { job_id?: string } } } };
  const session = event.data?.object;
  if (event.type === "checkout.session.completed" && session?.payment_status === "paid" && session.metadata?.job_id) {
    try {
      await markDepositPaid(session.metadata.job_id);
    } catch (err) {
      console.error("Marking deposit paid failed:", err);
      return NextResponse.json({ error: "Storage error" }, { status: 500 }); // Stripe retries
    }
  }
  return NextResponse.json({ received: true });
}
