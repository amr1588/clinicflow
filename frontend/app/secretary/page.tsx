"use client";

import React, { useCallback, useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import type { AppointmentStatus } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

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

// Secretary actions allowed per current status
const ACTIONS: Record<AppointmentStatus, { action: string; label: string; color: string }[]> = {
  pending:    [{ action: "confirm", label: "Confirm", color: "bg-green-600 hover:bg-green-700" },
               { action: "cancel",  label: "Cancel",  color: "bg-red-600 hover:bg-red-700"   }],
  confirmed:  [{ action: "check_in", label: "Check In", color: "bg-blue-600 hover:bg-blue-700" },
               { action: "no_show",  label: "No-show",  color: "bg-amber-600 hover:bg-amber-700" },
               { action: "cancel",   label: "Cancel",   color: "bg-red-600 hover:bg-red-700"  }],
  checked_in: [{ action: "complete", label: "Complete", color: "bg-purple-600 hover:bg-purple-700" }],
  completed:  [],
  cancelled:  [],
  no_show:    [],
};

// ── Component ──────────────────────────────────────────────────────────────

export default function SecretaryAppointmentsPage() {
  const [appts, setAppts] = useState<SecretaryAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Filters
  const [date,   setDate]   = useState(todayISO());
  const [status, setStatus] = useState("");

  // Action dialog state
  const [acting,       setActing]       = useState<SecretaryAppointment | null>(null);
  const [pendingAction, setPendingAction] = useState<string>("");
  const [cancelReason, setCancelReason] = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [actionError,  setActionError]  = useState<string | null>(null);
  const [toast,        setToast]        = useState<string | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────

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

  // ── Action handling ──────────────────────────────────────────────────────

  function openAction(appt: SecretaryAppointment, action: string) {
    setActing(appt);
    setPendingAction(action);
    setCancelReason("");
    setActionError(null);
  }

  function closeAction() {
    setActing(null);
    setPendingAction("");
  }

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

      // Update locally without refetching the whole list
      setAppts((prev) =>
        prev.map((a) =>
          a.id === acting.id ? { ...a, status: json.data.status } : a
        )
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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header + filters */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage the clinic's daily schedule
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {/* Date picker */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          {/* Status filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <div className="text-gray-500">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
            </div>
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && appts.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-16 text-center">
          <p className="text-sm text-slate-500">No appointments found for this selection.</p>
        </div>
      )}

      {/* Table */}
      {!loading && appts.length > 0 && (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Doctor</th>
                  <th className="px-4 py-3 text-left">Service</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appts.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    {/* Time + date */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{fmt12(a.time)}</div>
                      <div className="text-xs text-slate-400">{fmtDate(a.date)}</div>
                      <div className="text-xs text-slate-400">{a.duration_minutes} min</div>
                    </td>

                    {/* Patient */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {a.patient_first_name} {a.patient_last_name}
                      </div>
                      <div className="text-xs text-slate-400">{a.patient_email}</div>
                      {a.patient_phone && (
                        <div className="text-xs text-slate-400">{a.patient_phone}</div>
                      )}
                    </td>

                    {/* Doctor */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        Dr. {a.doctor_first_name} {a.doctor_last_name}
                      </div>
                      <div className="text-xs text-slate-400">{a.specialty}</div>
                    </td>

                    {/* Service */}
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{a.service_name}</div>
                      <div className="text-xs text-slate-400">${a.price}</div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                      {a.cancellation_reason && (
                        <p className="mt-1 text-xs text-slate-400">
                          "{a.cancellation_reason}"
                        </p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action confirmation dialog */}
      {acting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 capitalize">
              {pendingAction.replace("_", " ")} appointment
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              <strong>{acting.patient_first_name} {acting.patient_last_name}</strong> —{" "}
              {fmt12(acting.time)}, {acting.service_name}
            </p>

            {pendingAction === "cancel" && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">
                  Cancellation reason{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Reason for cancellation..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

            {actionError && (
              <p className="mt-3 text-sm text-red-600">{actionError}</p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={closeAction}
                disabled={submitting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          ✓ {toast}
        </div>
      )}
    </main>
  );
}
