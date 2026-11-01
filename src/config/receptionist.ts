// EDIT THIS FILE: it is the one place your business details live.
// Everything marked TODO is a placeholder until you paste in your real prices and times.

export type VehicleSize = "car" | "suv" | "truck";

export type Service = {
  id: string;
  label: string;
  /** Price in dollars for each vehicle size. TODO: replace with your real prices. */
  prices: Record<VehicleSize, number>;
  /** How long the job takes. TODO: these are estimates, use your real times. */
  minutes: number;
};

export const BUSINESS = {
  name: "TODO Business Name",
  timezone: "America/New_York", // TODO
  /** Hours the AI may book jobs, 24h clock. Index 0 = Sunday. null = closed. */
  hours: [
    null, // Sun
    { open: "08:00", close: "17:00" }, // Mon
    { open: "08:00", close: "17:00" },
    { open: "08:00", close: "17:00" },
    { open: "08:00", close: "17:00" },
    { open: "08:00", close: "17:00" }, // Fri
    null, // Sat
  ] as ({ open: string; close: string } | null)[],
  slotStepMinutes: 30,
  /** Don't offer slots starting sooner than this many hours from now. */
  minNoticeHours: 4,
  /** Don't book further out than this many days. */
  maxDaysAhead: 30,
  /** Deposit taken to hold the job, in dollars (0 = none). TODO */
  depositDollars: 0,
  paymentNote: "TODO: e.g. card or cash on completion",
  serviceArea: "TODO: e.g. within 25 miles of Springfield",
};

export const SERVICES: Service[] = [
  { id: "standard", label: "Standard job (TODO)", prices: { car: 100, suv: 120, truck: 140 }, minutes: 60 },
  { id: "premium", label: "Premium job (TODO)", prices: { car: 200, suv: 240, truck: 280 }, minutes: 120 },
];

/** Where the work happens. Per your flow, only "garage" or "shade" jobs get booked by the AI. */
export const LOCATIONS = ["garage", "shade"] as const;
