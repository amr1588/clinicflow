"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const [checked, setChecked] = useState(false); // avoids flashing "Login" before we know
  const [menuOpen, setMenuOpen] = useState(false);

  // Ask the backend who is logged in (re-runs when the page changes)
  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          setUser(null); // 401 just means "not logged in"
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

  // Where each role's dashboard lives
  const dashboardHref =
    user?.role === "secretary"
      ? "/secretary"
      : user?.role === "doctor"
        ? "/doctor"
        : "/patient/appointments";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white shadow-md shadow-blue-500/20">
            CF
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            ClinicFlow
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname.startsWith(l.href)
                  ? "border-b-2 border-blue-600 pb-0.5 text-blue-600"
                  : "hover:text-blue-600"
              }
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
                className="text-sm font-medium text-slate-600 hover:text-blue-600"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:shadow-lg"
              >
                Register
              </Link>
            </>
          )}
          {checked && user && (
            <>
              <Link
                href={dashboardHref}
                className="text-sm font-medium text-slate-700 hover:text-blue-600"
              >
                {user.first_name}
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Log out
              </button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
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
                <button onClick={handleLogout} className="text-left text-red-600">
                  Log out
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}