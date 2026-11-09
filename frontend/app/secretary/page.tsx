"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import type { AppointmentStatus } from "@/types";

interface SecretaryAppointment {
  id: number;
  date: string;
  time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  cancellation_reason: string | null;
  patient_first_name: string;
  patient_last_name: string;
  patient_email: string;
  patient_phone: string | null;
  doctor_first_name: string;
  doctor_last_name: string;
  specialty: string;
  service_name: string;
  price: string;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

function fmt12(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

const ACTIONS: Record<AppointmentStatus, { action: string; label: string; color: string }[]> = {
  pending:    [{ action: "confirm",  label: "Confirm",   color: "bg-green-600 hover:bg-green-700" },
               { action: "cancel",   label: "Cancel",    color: "bg-red-600 hover:bg-red-700" }],
  confirmed:  [{ action: "check_in", label: "Check In",  color: "bg-blue-600 hover:bg-blue-700" },
               { action: "no_show",  label: "No-show",   color: "bg-amber-600 hover:bg-amber-700" },
               { action: "cancel",   label: "Cancel",    color: "bg-red-600 hover:bg-red-700" }],
  checked_in: [{ action: "complete", label: "Complete",  color: "bg-purple-600 hover:bg-purple-700" }],
  completed:  [],
  cancelled:  [],
  no_show:    [],
};

const inputCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

export default function SecretaryAppointmentsPage() {
  const [appts,   setAppts]   = useState<SecretaryAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [date,   setDate]   = useState(todayISO());
  const [status, setStatus] = useState("");

  const [acting,        setActing]        = useState<SecretaryAppointment | null>(null);
  const [pendingAction, setPendingAction] = useState<string>("");
  const [cancelReason,  setCancelReason]  = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [actionError,   setActionError]   = useState<string | null>(null);
  const [toast,         setToast]         = useState<string | null>(null);

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

  function openAction(appt: SecretaryAppointment, action: string) {
    setActing(appt); setPendingAction(action); setCancelReason(""); setActionError(null);
  }
  function closeAction() { setActing(null); setPendingAction(""); }

  async function submitAction() {
    if (!acting) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const body: Record<string, string> = { action: pendingAction };
      if (pendingAction === "cancel" && cancelReason) body.reason = cancelReason;
      const res  = await fetch(`/api/appointments/${acting.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      setAppts((prev) =>
        prev.map((a) => a.id === acting.id ? { ...a, status: json.data.status } : a)
      );
      closeAction();
      showToast(`Appointment ${json.data.status.replace("_", " ")}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-cyan-50/10">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Appointments</h1>
            <p className="mt-1 text-slate-500">Manage the clinic's daily schedule</p>
          </div>
        </motion.div>

        {/* Filter bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm px-5 py-4 shadow-sm"
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date</label>
          <input
            type="date" value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400 ml-2">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
          <button onClick={load} className="ml-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition">
            ↻ Refresh
          </button>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <div className="flex justify-center py-24">
            <div className="h-11 w-11 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          </div>
        )}

        {!loading && !error && appts.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm text-slate-500">No appointments for this selection.</p>
          </motion.div>
        )}

        {/* Table */}
        {!loading && appts.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {["Time", "Patient", "Doctor", "Service", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appts.map((a, i) => (
                    <motion.tr
                      key={a.id}
                      variants={cardVariants}
                      initial="hidden"
                      animate="show"
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{fmt12(a.time)}</p>
                        <p className="text-xs text-slate-400">{fmtDate(a.date)}</p>
                        <p className="text-xs text-slate-400">{a.duration_minutes} min</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{a.patient_first_name} {a.patient_last_name}</p>
                        <p className="text-xs text-slate-400">{a.patient_email}</p>
                        {a.patient_phone && <p className="text-xs text-slate-400">{a.patient_phone}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">Dr. {a.doctor_first_name} {a.doctor_last_name}</p>
                        <p className="text-xs text-slate-400">{a.specialty}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-slate-700">{a.service_name}</p>
                        <p className="text-xs text-slate-400">${a.price}</p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={a.status} />
                        {a.cancellation_reason && (
                          <p className="mt-1 text-xs text-slate-400 italic">"{a.cancellation_reason}"</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {ACTIONS[a.status].map(({ action, label, color }) => (
                            <button
                              key={action}
                              onClick={() => openAction(a, action)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors ${color}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Action modal */}
        <AnimatePresence>
          {acting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 20 }}
                animate={{ opacity: 1, scale: 1,    y: 0 }}
                exit={{   opacity: 0, scale: 0.93, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"
              >
                <h2 className="text-lg font-bold text-slate-900 capitalize">
                  {pendingAction.replace("_", " ")} appointment
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">{acting.patient_first_name} {acting.patient_last_name}</span>
                  {" — "}{fmt12(acting.time)}, {acting.service_name}
                </p>

                {pendingAction === "cancel" && (
                  <div className="mt-5">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Cancellation reason <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Reason for cancellation…"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-none"
                    />
                  </div>
                )}

                <AnimatePresence>
                  {actionError && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="mt-3 text-sm text-red-600">{actionError}</motion.p>
                  )}
                </AnimatePresence>

                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={closeAction} disabled={submitting}
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                    Cancel
                  </button>
                  <button onClick={submitAction} disabled={submitting}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:shadow-lg disabled:opacity-60 transition-all">
                    {submitting ? "Saving…" : "Confirm"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20, x: "-50%" }}
              animate={{ opacity: 1, y: 0,  x: "-50%" }}
              exit={{   opacity: 0, y: 20,  x: "-50%" }}
              className="fixed bottom-6 left-1/2 z-50 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-xl"
            >
              ✓ {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
