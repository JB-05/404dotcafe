"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession, roleHome } from "@/lib/auth";

export function StaffGate({
  children,
  roles = ["STAFF", "ADMIN"],
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!roles.includes(session.role)) {
      router.replace(roleHome(session.role));
      return;
    }
    setReady(true);
  }, [router, pathname, roles]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/70">
        Checking access…
      </div>
    );
  }

  return children;
}
