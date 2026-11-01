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
