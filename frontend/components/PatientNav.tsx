"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const tabs = [
  { href: "/patient/appointments", label: "My Appointments" },
  { href: "/patient/profile",      label: "My Profile" },
];

export default function PatientNav() {
  const pathname = usePathname();

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      className="border-b border-slate-200/80 bg-white"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <nav className="flex gap-8">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`-mb-px border-b-2 py-3.5 text-sm font-semibold transition-colors ${
                pathname.startsWith(t.href)
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </motion.div>
  );
}
