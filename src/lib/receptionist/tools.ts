import { z } from "zod";
import { BUSINESS, LOCATIONS, SERVICES } from "@/config/receptionist";
import { busyBetween, createEvent } from "./google-calendar";
import { jpNumber, sendSms } from "./twilio";
import { saveJob } from "@/lib/crm/store";
import { createDepositCheckout } from "./stripe";
import { addDays, localMinutes, parseSpokenDate, parseTimeOfDay, spoken, todayIn, weekdayOf, WEEKDAY_NAMES, zonedToDate } from "./time";

// Prices are flat, so vehicle size is optional and only kept for the job record.
const size = z.enum(["car", "suv", "truck"]).optional().default("car");
const serviceId = z.enum(SERVICES.map((s) => s.id) as [string, ...string[]]);
const find = (id: string) => SERVICES.find((s) => s.id === id)!;

export const schemas = {
  quote_price: z.object({ service: serviceId, vehicle_size: size }),
  check_availability: z.object({ service: serviceId, date: z.string().min(1).max(60), preferred_time: z.string().max(30).optional() }),
  book_job: z.object({
    service: serviceId, vehicle_size: size, vehicle_description: z.string().max(200),
    location_type: z.enum(LOCATIONS), address: z.string().max(300),
    start: z.string().datetime({ offset: true }),
    customer_name: z.string().max(100), customer_phone: z.string().max(30).optional(), notes: z.string().max(500).optional(),
  }),
  text_jp: z.object({ reason: z.enum(["dealer", "complaint", "custom", "other_info", "no_garage_or_shade"]), customer_name: z.string().max(100).optional(), customer_phone: z.string().max(30).optional(), message: z.string().max(800) }),
};

export type ToolName = keyof typeof schemas;
export const isTool = (n: string): n is ToolName => n in schemas;

async function slotsFor(serviceMinutes: number, date: string): Promise<Date[]> {
  const tz = BUSINESS.timezone;
  const hours = BUSINESS.hours[weekdayOf(date)];
  if (!hours) return [];
  const open = zonedToDate(date, hours.open, tz);
  const close = zonedToDate(date, hours.close, tz);
  const earliest = Date.now() + BUSINESS.minNoticeHours * 3600_000;
  const busy = await busyBetween(open, close);
  const out: Date[] = [];
  for (let t = open.getTime(); t + serviceMinutes * 60_000 <= close.getTime(); t += BUSINESS.slotStepMinutes * 60_000) {
    const end = t + serviceMinutes * 60_000;
    if (t < earliest) continue;
    if (busy.some((b) => t < b.end.getTime() && end > b.start.getTime())) continue;
    out.push(new Date(t));
  }
  return out;
}

export async function run(tool: ToolName, raw: unknown): Promise<Record<string, unknown>> {
  const tz = BUSINESS.timezone;

  if (tool === "quote_price") {
    const a = schemas.quote_price.parse(raw);
    const s = find(a.service);
    return {
      service: s.label, price_dollars: s.price, starting_at: s.startingAt ?? false,
      price_note: s.startingAt ? "Starting price: the final price is set after inspection." : undefined,
      estimated_minutes: s.minutes, deposit_dollars: BUSINESS.depositDollars, payment: BUSINESS.paymentNote,
      service_area: BUSINESS.serviceArea,
    };
  }

  if (tool === "check_availability") {
    const a = schemas.check_availability.parse(raw);
    const today = todayIn(tz);
    const parsed = parseSpokenDate(a.date, today);
    if (!parsed) return { available: [], note: "Could not tell which day that is. Ask the caller to say the day again, for example 'Tuesday the 5th'." };
    const { date, mismatch } = parsed;
    if (date < today || date > addDays(today, BUSINESS.maxDaysAhead)) return { date, available: [], note: `Dates must be within the next ${BUSINESS.maxDaysAhead} days.` };

    let slots = await slotsFor(find(a.service).minutes, date);
    const want = a.preferred_time ? parseTimeOfDay(a.preferred_time) : null;
    let exact: boolean | undefined;
    if (want !== null) {
      const dist = (d: Date) => Math.abs(localMinutes(d, tz) - want);
      exact = slots.some((d) => dist(d) === 0);
      slots = [...slots].sort((x, y) => dist(x) - dist(y)).slice(0, 3).sort((x, y) => x.getTime() - y.getTime());
    } else {
      slots = slots.slice(0, 6);
    }
    const notes = [
      mismatch ? `The caller said ${WEEKDAY_NAMES[mismatch.saidWeekday]} but ${date} is a ${WEEKDAY_NAMES[mismatch.actualWeekday]}. Confirm which day they mean before booking.` : "",
      slots.length === 0 ? "Nothing open that day. Offer another day." : "",
      exact === false ? "The exact time they asked for is taken. Offer the closest times listed." : "",
    ].filter(Boolean).join(" ");
    return {
      date,
      day_spoken: `${WEEKDAY_NAMES[weekdayOf(date)]} ${date}`,
      exact_time_available: exact,
      available: slots.map((d) => ({ start: d.toISOString(), spoken: spoken(d, tz) })),
      note: notes || undefined,
    };
  }

  if (tool === "book_job") {
    const a = schemas.book_job.parse(raw);
    const s = find(a.service);
    const start = new Date(a.start);
    const end = new Date(start.getTime() + s.minutes * 60_000);
    // Re-check right before booking: the slot could have been taken since we offered it.
    const date = todayIn(tz, start);
    const stillFree = (await slotsFor(s.minutes, date)).some((d) => d.getTime() === start.getTime());
    if (!stillFree) return { booked: false, error: "That time is no longer available. Offer another slot." };

    const price = s.price;
    const priceText = `${s.startingAt ? "from " : ""}$${price}`;
    const when = spoken(start, tz);
    const event = await createEvent({
      summary: `${s.label}: ${a.customer_name} (${a.vehicle_description})`,
      description: [`Price: ${priceText}`, `Vehicle: ${a.vehicle_description} (${a.vehicle_size})`, `Location type: ${a.location_type}`, `Phone: ${a.customer_phone ?? "unknown"}`, a.notes ? `Notes: ${a.notes}` : ""].filter(Boolean).join("\n"),
      location: a.address, start, end, timeZone: tz,
    });
    // Deposit: a Stripe payment page, texted to the customer. Failure here never undoes the booking.
    const deposit = await createDepositCheckout({ jobId: event.id, label: s.label, customerName: a.customer_name, amountDollars: BUSINESS.depositDollars });
    try {
      await saveJob({
        id: event.id, calendarEventId: event.id, createdAt: Date.now(), startsAt: start.toISOString(), endsAt: end.toISOString(),
        serviceLabel: s.label, price, vehicle: a.vehicle_description, vehicleSize: a.vehicle_size, locationType: a.location_type,
        address: a.address, customerName: a.customer_name, customerPhone: a.customer_phone, notes: a.notes, status: "scheduled",
        depositDollars: BUSINESS.depositDollars, depositPaid: false, paymentUrl: deposit?.url,
      });
    } catch (err) {
      // The job is on the calendar already; a CRM hiccup must not fail the booking.
      console.error("CRM save failed:", err);
    }
    const depositLine = BUSINESS.depositDollars > 0 ? (deposit ? ` Deposit $${BUSINESS.depositDollars}: payment link sent to customer, shows as paid on the dashboard.` : ` Deposit $${BUSINESS.depositDollars}: NO payment link was created, send one yourself.`) : "";
    const summary = `New job: ${a.customer_name}, ${a.vehicle_description}. ${s.label} ${priceText}. ${when}. ${a.location_type}, ${a.address}. Phone ${a.customer_phone ?? "unknown"}.${a.notes ? ` Notes: ${a.notes}` : ""}${depositLine}`;
    const jp = jpNumber() ? await sendSms(jpNumber(), summary) : { sent: false as const, reason: "jp_number_not_set" };
    // The booking is already on the calendar; a text failure must not undo it.
    if (!jp.sent) console.warn("JP text not sent:", jp.reason);
    const custText = `${BUSINESS.name}: you're booked for ${when}. Total ${priceText}.${deposit ? ` Please pay your $${BUSINESS.depositDollars} deposit to hold your spot: ${deposit.url}` : ""}`;
    const cust = a.customer_phone ? await sendSms(a.customer_phone, custText) : null;
    const linkSent = !!(deposit && cust?.sent);
    return {
      booked: true, when, price_dollars: price, deposit_dollars: BUSINESS.depositDollars,
      confirmation_text_sent: cust?.sent ?? false, deposit_link_sent: linkSent,
      say_to_caller: BUSINESS.depositDollars === 0 ? "You're booked." : linkSent
        ? `You're booked. I'm texting you a secure link now to pay the $${BUSINESS.depositDollars} deposit, which holds your spot and is applied to your total.`
        : `You're booked. A $${BUSINESS.depositDollars} deposit is required to hold the spot, and JP will text you a payment link shortly.`,
    };
  }

  const a = schemas.text_jp.parse(raw);
  const r = await sendSms(jpNumber(), `Call-back needed (${a.reason}): ${a.customer_name ?? "unknown"} ${a.customer_phone ?? ""}. ${a.message}`);
  if (!r.sent) console.warn("JP text not sent:", r.reason);
  return { texted_jp: r.sent, say_to_caller: "JP will text or call you back shortly." };
}
