// EDIT THIS FILE: it is the one place your business details live.
// Prices and services come from https://blackline-project.vercel.app/ ; job lengths are estimates.

export type VehicleSize = "car" | "suv" | "truck";

export type Service = {
  id: string;
  label: string;
  /** Flat price in dollars (the site doesn't price by vehicle size). */
  price: number;
  /** True when the price is a starting price, final price set after inspection. */
  startingAt?: boolean;
  /** How long the job blocks the calendar. */
  minutes: number;
};

export const BUSINESS = {
  name: "Blackline Care Detail",
  timezone: "America/New_York",
  /** Hours the AI may book jobs, 24h clock. Index 0 = Sunday. null = closed. Mon-Sat. TODO: confirm your real hours. */
  hours: [
    null, // Sun
    { open: "08:00", close: "17:00" }, // Mon
    { open: "08:00", close: "17:00" },
    { open: "08:00", close: "17:00" },
    { open: "08:00", close: "17:00" },
    { open: "08:00", close: "17:00" }, // Fri
    { open: "08:00", close: "17:00" }, // Sat
  ] as ({ open: string; close: string } | null)[],
  slotStepMinutes: 30,
  /** Don't offer slots starting sooner than this many hours from now. */
  minNoticeHours: 4,
  /** Don't book further out than this many days. */
  maxDaysAhead: 30,
  depositDollars: 50,
  paymentNote: "A $50 deposit is required to book and is applied to the total. The remaining balance is due on-site.",
  serviceArea: "Fully mobile, based in Venice, FL. We travel up to 25 miles from Venice.",
};

export const SERVICES: Service[] = [
  { id: "interior", label: "Interior Detail", price: 75, minutes: 45 },
  { id: "exterior", label: "Exterior Detail", price: 75, minutes: 45 },
  { id: "full_detail", label: "Full Detail (Interior and Exterior)", price: 150, minutes: 120 },
  { id: "clay_bar", label: "Clay Bar Treatment", price: 40, minutes: 60 },
  { id: "maintenance", label: "Maintenance Detail", price: 90, minutes: 90 },
  { id: "stage1", label: "Single-Step Polish (Stage 1)", price: 250, minutes: 240 },
  { id: "stage2", label: "Two-Step Correction (Stage 2)", price: 450, minutes: 420 },
  { id: "stage3", label: "Multi-Stage Correction (Stage 3)", price: 750, startingAt: true, minutes: 480 },
  { id: "ceramic", label: "Ceramic Coating", price: 700, minutes: 240 },
];

/** Where the work happens. Per your flow, only "garage" or "shade" jobs get booked by the AI. */
export const LOCATIONS = ["garage", "shade"] as const;
