"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/patient/appointments", label: "My Appointments" },
  { href: "/patient/profile", label: "My Profile" },
];

export default function PatientNav() {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <div className="flex gap-6 border-b border-slate-200">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium ${
              pathname.startsWith(t.href)
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
