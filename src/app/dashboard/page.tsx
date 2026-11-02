import { dateTime, dayKey, duration, money, phone, statusLabel, timeOnly } from "@/lib/crm/format";
import { listCalls, listJobs } from "@/lib/crm/store";

// Computed outside the component so the page stays a pure render of its data.
async function loadOverview() {
  const [jobs, calls] = await Promise.all([listJobs(), listCalls(100)]);
  const now = Date.now();
  const today = dayKey(now);
  const month = today.slice(0, 7);
  const live = jobs.filter((j) => j.status !== "cancelled");
  const todays = jobs.filter((j) => dayKey(Date.parse(j.startsAt)) === today).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = live.filter((j) => j.status === "scheduled" && Date.parse(j.startsAt) > now).length;
  const monthRevenue = live.filter((j) => dayKey(Date.parse(j.startsAt)).startsWith(month)).reduce((sum, j) => sum + j.price, 0);
  const weekCalls = calls.filter((c) => c.at > now - 7 * 864e5);
  return { calls, todays, upcoming, monthRevenue, weekCalls, booked: weekCalls.filter((c) => c.successful).length };
}

export default async function Overview() {
  const { calls, todays, upcoming, monthRevenue, weekCalls, booked } = await loadOverview();

  return (
    <>
      <h1>Overview</h1>
      <p className="sub">Today at a glance.</p>
      <div className="grid">
        <div className="card kpi"><div className="label">Jobs today</div><div className="num">{todays.length}</div></div>
        <div className="card kpi"><div className="label">Upcoming jobs</div><div className="num">{upcoming}</div><div className="hint">scheduled, not yet done</div></div>
        <div className="card kpi"><div className="label">Booked this month</div><div className="num">{money(monthRevenue)}</div></div>
        <div className="card kpi"><div className="label">Calls this week</div><div className="num">{weekCalls.length}</div><div className="hint">{booked} marked successful</div></div>
      </div>
      <div className="cols">
        <div className="card">
          <h2>Today&apos;s schedule</h2>
          {todays.length === 0 ? <div className="empty">Nothing scheduled today.</div> : (
            <div className="list">
              {todays.map((j) => (
                <div key={j.id} className="row">
                  <div><strong>{timeOnly(j.startsAt)}</strong> · {j.customerName}<div className="muted">{j.vehicle} · {j.serviceLabel} · {j.address}</div></div>
                  <div style={{ textAlign: "right" }}><div>{money(j.price)}</div><span className={`badge b-${j.status}`}>{statusLabel(j.status)}</span>{j.depositDollars && !j.depositPaid ? <div className="muted">deposit due</div> : null}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2>Recent calls</h2>
          {calls.length === 0 ? <div className="empty">No calls yet.</div> : (
            <div className="list">
              {calls.slice(0, 6).map((c) => (
                <div key={c.id}>
                  <div className="row"><strong>{phone(c.fromNumber)}</strong><span className="muted">{dateTime(c.at)} · {duration(c.durationSec)}</span></div>
                  <div className="muted">{c.summary ?? "Summary pending…"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
