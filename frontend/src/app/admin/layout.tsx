"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { StaffGate } from "@/components/StaffGate";
import { clearSession, getSession } from "@/lib/auth";
import "./admin.css";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/finance", label: "Finance" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = getSession();

  return (
    <StaffGate roles={["ADMIN"]}>
      <div className="admin-shell">
        <header className="admin-header px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">404 Café · Admin</h1>
            <p className="text-sm admin-muted">{session?.name}</p>
          </div>
          <nav className="flex flex-wrap gap-1 items-center">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-link ${pathname === item.href ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
            <span className="mx-1 text-slate-300">|</span>
            <Link href="/pos" className="admin-nav-link">
              POS
            </Link>
            <button
              type="button"
              onClick={() => {
                clearSession();
                router.push("/login");
              }}
              className="admin-nav-link"
            >
              Logout
            </button>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </div>
    </StaffGate>
  );
}
