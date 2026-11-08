"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import type { AppointmentStatus } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface DoctorAppointment {
  id: number;
  date: string;
  time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  cancellation_reason: string | null;
  patient_first_name: string;
  patient_last_name: string;
  service_name: string;
  price: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmt12(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DoctorAppointmentsPage() {
  const [appts,   setAppts]   = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Filters
  const [date,   setDate]   = useState(todayISO());
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (date)   params.set("date",   date);
      if (status) params.set("status", status);

      const res  = await fetch(`/api/appointments?${params}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setAppts(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [date, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

      {/* Header + filters */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Appointments</h1>
          <p className="mt-0.5 text-sm text-slate-500">Your scheduled patient visits</p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {/* Date picker */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />

          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>

          <button
            onClick={load}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && appts.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-16 text-center">
          <p className="text-sm text-slate-500">No appointments found for this selection.</p>
        </div>
      )}

      {/* Appointments list */}
      {!loading && appts.length > 0 && (
        <div className="space-y-3">
          {appts.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:border-emerald-200 hover:shadow transition-all"
            >
              {/* Time & date */}
              <div className="min-w-[90px]">
                <p className="font-semibold text-slate-900">{fmt12(a.time)}</p>
                <p className="text-xs text-slate-400">{fmtDate(a.date)}</p>
                <p className="text-xs text-slate-400">{a.duration_minutes} min</p>
              </div>

              {/* Patient */}
              <div className="flex-1 min-w-[140px]">
                <p className="font-medium text-slate-900">
                  {a.patient_first_name} {a.patient_last_name}
                </p>
                <p className="text-xs text-slate-400">{a.service_name}</p>
              </div>

              {/* Status */}
              <StatusBadge status={a.status} />

              {/* Notes / link */}
              <div className="ml-auto flex items-center gap-3">
                {/* Show notes link only for checked-in or completed */}
                {(a.status === "checked_in" || a.status === "completed") && (
                  <Link
                    href={`/doctor/appointments/${a.id}`}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    {a.status === "completed" ? "View Notes" : "Add Notes"}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

