import { updateJobStatus } from "@/app/actions";
import type { Job } from "@/lib/crm/types";

const BTN: { status: string; label: string }[] = [
  { status: "completed", label: "Complete" },
  { status: "no_show", label: "No-show" },
  { status: "cancelled", label: "Cancel" },
  { status: "scheduled", label: "Reopen" },
];

export function JobActions({ job }: { job: Job }) {
  return (
    <div className="actions">
      {BTN.filter((b) => b.status !== job.status && (job.status === "scheduled" ? b.status !== "scheduled" : b.status === "scheduled" || b.status === job.status)).map((b) => (
        <form key={b.status} action={updateJobStatus}>
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="status" value={b.status} />
          <button className="btn" type="submit">{b.label}</button>
        </form>
      ))}
    </div>
  );
}
