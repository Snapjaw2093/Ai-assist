import Link from "next/link";
import { JobActions } from "@/components/job-status";
import { dateTime, money, phone, statusLabel } from "@/lib/crm/format";
import { listJobs } from "@/lib/crm/store";

const TABS = [["all", "All"], ["scheduled", "Scheduled"], ["completed", "Completed"], ["no_show", "No-show"], ["cancelled", "Cancelled"]];

export default async function Jobs({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "all" } = await searchParams;
  const all = await listJobs();
  const jobs = (status === "all" ? all : all.filter((j) => j.status === status)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return (
    <>
      <h1>Jobs</h1>
      <p className="sub">Every job the receptionist has booked.</p>
      <div className="tabs">{TABS.map(([k, l]) => <Link key={k} href={k === "all" ? "/dashboard/jobs" : `/dashboard/jobs?status=${k}`} className={status === k ? "on" : ""}>{l}</Link>)}</div>
      <div className="card tablecard">
        {jobs.length === 0 ? <div className="empty">No jobs here yet.</div> : (
          <table>
            <thead><tr><th>When</th><th>Customer</th><th>Job</th><th>Where</th><th>Price</th><th>Status</th><th /></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{dateTime(j.startsAt)}</td>
                  <td>{j.customerName}<div className="muted">{phone(j.customerPhone)}</div></td>
                  <td>{j.serviceLabel}<div className="muted">{j.vehicle}</div>{j.notes && <div className="muted">“{j.notes}”</div>}</td>
                  <td>{j.address}<div className="muted">{j.locationType}</div></td>
                  <td>{money(j.price)}</td>
                  <td><span className={`badge b-${j.status}`}>{statusLabel(j.status)}</span></td>
                  <td><JobActions job={j} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
