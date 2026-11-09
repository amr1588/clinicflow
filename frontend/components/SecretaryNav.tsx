"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="border-b border-slate-200/80 bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <nav className="flex flex-row items-center gap-2 overflow-x-auto">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`whitespace-nowrap border-b-2 py-3 px-4 text-sm font-semibold transition-colors ${
                  active
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </motion.div>
  );
}
