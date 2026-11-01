import { dateTime, money, phone } from "@/lib/crm/format";
import { listCustomers } from "@/lib/crm/store";

export default async function Customers() {
  const customers = await listCustomers();
  return (
    <>
      <h1>Customers</h1>
      <p className="sub">Built automatically from calls and bookings, grouped by phone number.</p>
      <div className="card tablecard">
        {customers.length === 0 ? <div className="empty">No customers yet.</div> : (
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Jobs</th><th>Total booked</th><th>Calls</th><th>Last activity</th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.phone}><td>{c.name || <span className="muted">Unknown</span>}</td><td>{phone(c.phone)}</td><td>{c.jobs}</td><td>{money(c.spent)}</td><td>{c.calls}</td><td>{dateTime(c.lastSeen)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
