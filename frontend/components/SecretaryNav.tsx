"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@/types";

const tabs = [
  { href: "/secretary",          label: "Appointments", exact: true },
  { href: "/secretary/patients", label: "Patients" },
  { href: "/secretary/doctors",  label: "Doctors" },
  { href: "/secretary/services", label: "Services" },
  { href: "/secretary/leads",    label: "Leads" },
];

export default function SecretaryNav({ user }: { user: User }) {
  const pathname = usePathname();
  const router   = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center pt-6">
          <div className="flex items-center gap-2">
            {/* pill badge */}
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              Secretary
            </span>
            <span className="text-sm font-medium text-slate-700">
              {user.first_name} {user.last_name}
            </span>
          </div>
        </div>

        {/* Tab row */}
        <nav className="flex flex-row justify-center items-center gap-6 mb-4">
          {tabs.map((t) => {
            const active = t.exact
              ? pathname === t.href
              : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`whitespace-nowrap border-b-2 pb-1 text-sm font-medium transition-colors ${
                  active
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
