"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SecretaryNav from "@/components/SecretaryNav";
import type { ApiResponse, User } from "@/types";

/**
 * SecretaryGuard – wraps every page under /secretary.
 * On mount it calls GET /api/auth/me; if not a secretary it redirects away.
 * Passes the secretary user object down as a prop so child pages can display
 * the secretary's name without making a second /me request.
 */
export default function SecretaryGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ok" | "leaving" | "error">("checking");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });

        if (res.status === 401) {
          if (!cancelled) {
            setStatus("leaving");
            router.replace("/login");
          }
          return;
        }
        if (!res.ok) throw new Error("Server error");

        const json: ApiResponse<User> = await res.json();

        if (json.data.role !== "secretary") {
          if (!cancelled) {
            setStatus("leaving");
            // redirect to the right area
            const dest =
              json.data.role === "doctor"
                ? "/doctor"
                : "/patient/appointments";
            router.replace(dest);
          }
          return;
        }

        if (!cancelled) {
          setUser(json.data);
          setStatus("ok");
        }
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
          <p className="font-medium text-red-700">
            Could not reach the server. Please try again.
          </p>
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
      <SecretaryNav user={user!} />
      {children}
    </>
  );
}
