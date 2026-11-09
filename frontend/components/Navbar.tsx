"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { ApiResponse, User } from "@/types";

const links = [
  { href: "/doctors", label: "Doctors" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          setUser(null);
          return;
        }
        const json: ApiResponse<User> = await res.json();
        setUser(json.data);
      } catch {
        setUser(null);
      } finally {
        setChecked(true);
      }
    };
    loadUser();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      setMenuOpen(false);
      router.push("/login");
      router.refresh();
    }
  };

  const dashboardHref =
    user?.role === "secretary"
      ? "/secretary"
      : user?.role === "doctor"
        ? "/doctor"
        : "/patient/appointments";

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-md shadow-blue-500/20">
            CF
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
            ClinicFlow
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`transition-colors ${
                pathname.startsWith(l.href)
                  ? "border-b-2 border-blue-600 pb-0.5 text-blue-600 font-semibold"
                  : "hover:text-blue-600"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Desktop auth area */}
        <div className="hidden items-center gap-3 md:flex">
          {checked && !user && (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors px-2 py-1"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:shadow-lg transition-all"
              >
                Register
              </Link>
            </>
          )}
          {checked && user && (
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                  user.role === "doctor"
                    ? "bg-emerald-100 text-emerald-700"
                    : user.role === "secretary"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                }`}
              >
                {user.role}
              </span>
              <Link
                href={dashboardHref}
                className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
              >
                {user.first_name} {user.last_name}
              </Link>
              <button
                onClick={handleLogout}
                className="cursor-pointer rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-200 hover:bg-red-600 hover:border-red-600 hover:text-white hover:shadow-sm active:scale-95"
              >
                Log out
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="cursor-pointer rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Toggle menu"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-slate-700">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </Link>
            ))}
            <hr className="border-slate-200" />
            {checked && !user && (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)}>
                  Log in
                </Link>
                <Link href="/register" onClick={() => setMenuOpen(false)}>
                  Register
                </Link>
              </>
            )}
            {checked && user && (
              <>
                <Link href={dashboardHref} onClick={() => setMenuOpen(false)}>
                  My dashboard ({user.first_name})
                </Link>
                <button
                  onClick={handleLogout}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-left text-sm font-semibold text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                >
                  Log out
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </motion.header>
  );
}
