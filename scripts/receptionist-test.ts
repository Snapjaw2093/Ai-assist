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
  const q = await run("quote_price", { service: "standard", vehicle_size: "suv" });
  assert.equal(q.price_dollars, 120);
  await assert.rejects(run("quote_price", { service: "bogus", vehicle_size: "suv" }));
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
