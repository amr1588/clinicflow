"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoctorNav from "@/components/DoctorNav";
import type { ApiResponse, User } from "@/types";

/**
 * DoctorGuard – wraps every page under /doctor.
 * On mount it calls GET /api/auth/me; redirects non-doctors away.
 * Passes the authenticated doctor user down so children can display their name.
 */
export default function DoctorGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ok" | "leaving" | "error">("checking");
  const [user,   setUser]   = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });

        if (res.status === 401) {
          if (!cancelled) { setStatus("leaving"); router.replace("/login"); }
          return;
        }
        if (!res.ok) throw new Error("Server error");

        const json: ApiResponse<User> = await res.json();

        if (json.data.role !== "doctor") {
          if (!cancelled) {
            setStatus("leaving");
            const dest =
              json.data.role === "secretary"
                ? "/secretary"
                : "/patient/appointments";
            router.replace(dest);
          }
          return;
        }

        if (!cancelled) { setUser(json.data); setStatus("ok"); }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    check();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "checking") {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (status === "leaving") return null;

  if (status === "error") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">Could not reach the server. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-red-600 underline underline-offset-2 hover:text-red-800"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <DoctorNav user={user!} />
      {children}
    </>
  );
}

