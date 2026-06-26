"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { StaffGate } from "@/components/StaffGate";
import { clearSession, getSession } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/finance", label: "Finance" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = getSession();

  return (
    <StaffGate roles={["ADMIN"]}>
      <div className="min-h-screen">
        <header className="border-b border-white/10 px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-bebas)] text-3xl">ADMIN</h1>
            <p className="text-sm text-white/60">{session?.name}</p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded ${
                  pathname === item.href
                    ? "bg-[var(--color-accent)] text-black font-medium"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                clearSession();
                router.push("/login");
              }}
              className="px-3 py-1.5 text-white/70 hover:text-white"
            >
              Logout
            </button>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    </StaffGate>
  );
}
