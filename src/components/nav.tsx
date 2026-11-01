"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/jobs", label: "Jobs" },
  { href: "/dashboard/calls", label: "Calls" },
  { href: "/dashboard/customers", label: "Customers" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className={path === i.href || (i.href !== "/dashboard" && path.startsWith(i.href)) ? "on" : ""}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
