"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PatientNav from "@/components/PatientNav";
import type { ApiResponse, User } from "@/types";

export default function PatientGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"checking" | "ok" | "leaving" | "error">(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });

        if (res.status === 401) {
          if (!cancelled) {
            setStatus("leaving");
            router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          }
          return;
        }
        if (!res.ok) throw new Error("Request failed");

        const json: ApiResponse<User> = await res.json();

        // Doctors and secretaries have their own areas (built in later phases)
        if (json.data.role !== "patient") {
          if (!cancelled) {
            setStatus("leaving");
            router.replace("/");
          }
          return;
        }

        if (!cancelled) setStatus("ok");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    check();
    return () => {
      cancelled = true;
    };
    // Runs once when the patient area opens. The layout stays mounted
    // while moving between patient pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "checking") {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (status === "leaving") return null;

  if (status === "error") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">
            Could not reach the server. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-red-600 underline underline-offset-2 hover:text-red-800"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <PatientNav />
      {children}
    </>
  );
}
