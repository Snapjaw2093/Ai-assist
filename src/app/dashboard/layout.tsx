import { BUSINESS } from "@/config/receptionist";
import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/crm/auth";
import { storeMode } from "@/lib/crm/store";
import { logout } from "../actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">{BUSINESS.name}<small>AI receptionist</small></div>
        <Nav />
        <form action={logout}><button className="btn" type="submit">Sign out</button></form>
      </aside>
      <main className="main">
        {storeMode === "memory" && (
          <div className="notice">No database connected yet, so data disappears on restart. Add Upstash Redis in Vercel → Storage to keep it.</div>
        )}
        {children}
      </main>
    </div>
  );
}
