import { z } from "zod";
import { BUSINESS, LOCATIONS, SERVICES } from "@/config/receptionist";
import { busyBetween, createEvent } from "./google-calendar";
import { jpNumber, sendSms } from "./twilio";
import { addDays, spoken, todayIn, weekdayOf, zonedToDate } from "./time";

const size = z.enum(["car", "suv", "truck"]);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
const serviceId = z.enum(SERVICES.map((s) => s.id) as [string, ...string[]]);
const find = (id: string) => SERVICES.find((s) => s.id === id)!;

export const schemas = {
  quote_price: z.object({ service: serviceId, vehicle_size: size }),
  check_availability: z.object({ service: serviceId, date: day }),
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
    return { price_dollars: s.prices[a.vehicle_size], estimated_minutes: s.minutes, deposit_dollars: BUSINESS.depositDollars, payment: BUSINESS.paymentNote };
  }

  if (tool === "check_availability") {
    const a = schemas.check_availability.parse(raw);
    const today = todayIn(tz);
    if (a.date < today || a.date > addDays(today, BUSINESS.maxDaysAhead)) return { available: [], note: `Dates must be within the next ${BUSINESS.maxDaysAhead} days.` };
    const slots = await slotsFor(find(a.service).minutes, a.date);
    return {
      available: slots.slice(0, 6).map((d) => ({ start: d.toISOString(), spoken: spoken(d, tz) })),
      note: slots.length ? undefined : "Nothing open that day. Try another date.",
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

    const price = s.prices[a.vehicle_size];
    const when = spoken(start, tz);
    await createEvent({
      summary: `${s.label}: ${a.customer_name} (${a.vehicle_description})`,
      description: [`Price: $${price}`, `Vehicle: ${a.vehicle_description} (${a.vehicle_size})`, `Location type: ${a.location_type}`, `Phone: ${a.customer_phone ?? "unknown"}`, a.notes ? `Notes: ${a.notes}` : ""].filter(Boolean).join("\n"),
      location: a.address, start, end, timeZone: tz,
    });
    const summary = `New job: ${a.customer_name}, ${a.vehicle_description}. ${s.label} $${price}. ${when}. ${a.location_type}, ${a.address}. Phone ${a.customer_phone ?? "unknown"}.${a.notes ? ` Notes: ${a.notes}` : ""}`;
    const jp = jpNumber() ? await sendSms(jpNumber(), summary) : { sent: false as const, reason: "jp_number_not_set" };
    // The booking is already on the calendar; a text failure must not undo it.
    if (!jp.sent) console.warn("JP text not sent:", jp.reason);
    const cust = a.customer_phone ? await sendSms(a.customer_phone, `${BUSINESS.name}: you're booked for ${when}. Total $${price}. Reply here with questions.`) : null;
    return { booked: true, when, price_dollars: price, deposit_dollars: BUSINESS.depositDollars, confirmation_text_sent: cust?.sent ?? false };
  }

  const a = schemas.text_jp.parse(raw);
  const r = await sendSms(jpNumber(), `Call-back needed (${a.reason}): ${a.customer_name ?? "unknown"} ${a.customer_phone ?? ""}. ${a.message}`);
  if (!r.sent) console.warn("JP text not sent:", r.reason);
  return { texted_jp: r.sent, say_to_caller: "JP will text or call you back shortly." };
}
