"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import PreviousVisits from "@/components/PreviousVisits";
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

// ── Shared Input Classes ────────────────────────────────────────────────────

const inputCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition";

// ── Animation Variants ─────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

// ── Component ──────────────────────────────────────────────────────────────

export default function DoctorAppointmentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [appts,   setAppts]   = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [date,   setDate]   = useState(todayISO());
  const [status, setStatus] = useState("");
  const [historyModalAppt, setHistoryModalAppt] = useState<DoctorAppointment | null>(null);
  const [navigatingId, setNavigatingId] = useState<number | null>(null);

  // Clear loading state when page mounts, pathname changes, or window regains focus/shows from cache
  useEffect(() => {
    setNavigatingId(null);
    const handleReset = () => setNavigatingId(null);
    window.addEventListener("pageshow", handleReset);
    window.addEventListener("focus", handleReset);
    return () => {
      window.removeEventListener("pageshow", handleReset);
      window.removeEventListener("focus", handleReset);
    };
  }, [pathname]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/10">
      {/* Top Loading Progress Bar when navigating */}
      {navigatingId !== null && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden bg-emerald-100">
          <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Appointments</h1>
          <p className="mt-1 text-slate-500">Your scheduled patient visits</p>
        </motion.div>

        {/* Filter bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.2 }}
          className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm px-5 py-4 shadow-sm"
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />

          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 ml-2">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputCls}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>

          <button
            onClick={load}
            className="ml-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
          >
            ↻ Refresh
          </button>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-24">
            <div className="h-11 w-11 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        )}

        {/* Empty */}
        {!loading && !error && appts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center"
          >
            <p className="text-2xl mb-2">🗓️</p>
            <p className="text-sm text-slate-500">No appointments for this selection.</p>
          </motion.div>
        )}

        {/* Appointments list */}
        {!loading && appts.length > 0 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {appts.map((a) => (
              <motion.div
                key={a.id}
                variants={cardVariants}
                className="group flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all"
              >
                {/* Time block */}
                <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                  <span className="text-sm font-bold leading-tight">{fmt12(a.time).split(" ")[0]}</span>
                  <span className="text-[10px] font-semibold">{fmt12(a.time).split(" ")[1]}</span>
                </div>

                {/* Patient + service */}
                <div className="flex-1 min-w-[140px]">
                  <p className="font-semibold text-slate-900 text-base">
                    {a.patient_first_name} {a.patient_last_name}
                  </p>
                  <p className="text-sm text-slate-400">{a.service_name} · {fmtDate(a.date)}</p>
                </div>

                {/* Duration */}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {a.duration_minutes} min
                </span>

                {/* Status */}
                <StatusBadge status={a.status} />

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryModalAppt(a)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-emerald-700 transition-colors cursor-pointer"
                    title="View patient history and previous notes"
                  >
                    📋 Past Notes
                  </button>

                  {(a.status === "checked_in" || a.status === "completed") && (
                    <button
                      type="button"
                      disabled={navigatingId !== null}
                      onMouseEnter={() => router.prefetch(`/doctor/appointments/${a.id}`)}
                      onClick={() => {
                        setNavigatingId(a.id);
                        router.push(`/doctor/appointments/${a.id}`);
                        // Safety timeout: auto-clear after 2.5s so button is never permanently stuck
                        setTimeout(() => {
                          setNavigatingId(null);
                        }, 2500);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-80 cursor-pointer"
                    >
                      {navigatingId === a.id ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <span>{a.status === "completed" ? "View Notes" : "Add Notes →"}</span>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* History Modal Dialog */}
      <AnimatePresence>
        {historyModalAppt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryModalAppt(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl bg-white shadow-2xl p-6 z-10"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {historyModalAppt.patient_first_name} {historyModalAppt.patient_last_name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Patient medical notes history
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryModalAppt(null)}
                  className="rounded-full h-8 w-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <PreviousVisits
                appointmentId={historyModalAppt.id}
                patientName={`${historyModalAppt.patient_first_name} ${historyModalAppt.patient_last_name}`}
              />

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setHistoryModalAppt(null)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
