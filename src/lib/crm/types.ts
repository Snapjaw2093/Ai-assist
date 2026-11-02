export type JobStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export const JOB_STATUSES: JobStatus[] = ["scheduled", "completed", "cancelled", "no_show"];

export type Job = {
  id: string;
  createdAt: number;
  startsAt: string; // ISO
  endsAt: string; // ISO
  serviceLabel: string;
  price: number;
  vehicle: string;
  vehicleSize: string;
  locationType: string;
  address: string;
  customerName: string;
  customerPhone?: string;
  notes?: string;
  status: JobStatus;
  calendarEventId?: string;
  depositDollars?: number;
  depositPaid?: boolean;
  paymentUrl?: string;
  paidAt?: number;
};

export type CallRecord = {
  id: string;
  at: number; // ms epoch
  fromNumber?: string;
  durationSec?: number;
  summary?: string;
  transcript?: string;
  recordingUrl?: string;
  sentiment?: string;
  successful?: boolean;
  disconnectionReason?: string;
};

export type Customer = {
  phone: string;
  name: string;
  jobs: number;
  spent: number;
  calls: number;
  lastSeen: number;
};
