"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import type { ApiResponse, Appointment } from "@/types";

type Tab = "upcoming" | "past" | "cancelled";

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatDateNice(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function startsAt(a: Appointment) {
  return new Date(`${a.date}T${a.time}:00`);
}

function tabOf(a: Appointment): Tab {
  if (a.status === "cancelled" || a.status === "no_show") return "cancelled";
  const active =
    a.status === "pending" ||
    a.status === "confirmed" ||
    a.status === "checked_in";
  return active && startsAt(a) > new Date() ? "upcoming" : "past";
}

export default function PatientAppointmentsPage() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");

  // Cancel dialog state
  const [toCancel, setToCancel] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/appointments", {
          credentials: "include",
        });

        if (res.status === 401) {
          router.push("/login?next=/patient/appointments");
          return;
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(
            errData?.error || "Could not reach the server. Please try again.",
          );
        }

        const json: ApiResponse<Appointment[]> = await res.json();
        if (!cancelled) setAppointments(json.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const openCancel = (a: Appointment) => {
    setToCancel(a);
    setCancelReason("");
    setCancelError(null);
  };

  const confirmCancel = async () => {
    if (!toCancel) return;

    try {
      setCancelling(true);
      setCancelError(null);

      const res = await fetch(`/api/appointments/${toCancel.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: cancelReason.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Could not cancel the appointment");
      }

      // Update the list locally
      setAppointments((list) =>
        list.map((a) =>
          a.id === toCancel.id
            ? {
                ...a,
                status: "cancelled",
                cancellation_reason: cancelReason.trim() || null,
              }
            : a,
        ),
      );
      setToCancel(null);
      setNotice("Your appointment was cancelled.");
    } catch (err) {
      setCancelError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setCancelling(false);
    }
  };

  const counts = {
    upcoming: appointments.filter((a) => tabOf(a) === "upcoming").length,
    past: appointments.filter((a) => tabOf(a) === "past").length,
    cancelled: appointments.filter((a) => tabOf(a) === "cancelled").length,
  };

  // Upcoming: soonest first. Past and cancelled: newest first (already how the API sorts).
  const visible = appointments
    .filter((a) => tabOf(a) === tab)
    .sort((a, b) =>
      tab === "upcoming"
        ? startsAt(a).getTime() - startsAt(b).getTime()
        : startsAt(b).getTime() - startsAt(a).getTime(),
    );

  const tabs: { key: Tab; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
    { key: "cancelled", label: "Cancelled" },
  ];

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-sm text-slate-500">
            Loading your appointments…
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">{error}</p>
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
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            My Appointments
          </h1>
          <p className="mt-2 text-base text-slate-500">
            Your upcoming visits and history.
          </p>
        </div>
        <Link
          href="/book"
          className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:shadow-lg"
        >
          Book new appointment
        </Link>
      </div>

      {notice && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setNotice(null);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-blue-300"
            }`}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold text-slate-700">
            No {tab} appointments
          </h2>
          {tab === "upcoming" && (
            <p className="mt-1 text-sm text-slate-500">
              Ready to see a doctor?{" "}
              <Link
                href="/book"
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                Book an appointment
              </Link>
            </p>
          )}
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {visible.map((a) => {
            const canCancel =
              (a.status === "pending" || a.status === "confirmed") &&
              startsAt(a) > new Date();

            return (
              <li
                key={a.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Dr. {a.doctor_first_name} {a.doctor_last_name}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {a.service_name} · {a.specialty}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>

                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div>
                    <p className="text-slate-400">Date</p>
                    <p className="font-medium text-slate-900">
                      {formatDateNice(a.date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Time</p>
                    <p className="font-medium text-slate-900">
                      {formatTime(a.time)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Duration</p>
                    <p className="font-medium text-slate-900">
                      {a.duration_minutes} min
                    </p>
                  </div>
                </div>

                {a.reason && (
                  <p className="mt-3 text-sm text-slate-500">
                    <span className="text-slate-400">Reason: </span>
                    {a.reason}
                  </p>
                )}
                {a.status === "cancelled" && a.cancellation_reason && (
                  <p className="mt-3 text-sm text-slate-500">
                    <span className="text-slate-400">
                      Cancellation reason:{" "}
                    </span>
                    {a.cancellation_reason}
                  </p>
                )}

                {canCancel && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <button
                      onClick={() => openCancel(a)}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Cancel appointment
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Confirmation dialog */}
      {toCancel && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Cancel this appointment?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Dr. {toCancel.doctor_first_name} {toCancel.doctor_last_name} ·{" "}
              {formatDateNice(toCancel.date)} at {formatTime(toCancel.time)}
            </p>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Reason <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            {cancelError && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {cancelError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setToCancel(null)}
                disabled={cancelling}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Keep appointment
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelling}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {cancelling ? "Cancelling…" : "Yes, cancel it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
