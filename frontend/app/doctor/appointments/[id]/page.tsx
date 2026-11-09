"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import StatusBadge from "@/components/StatusBadge";
import PreviousVisits from "@/components/PreviousVisits";
import type { AppointmentStatus } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface ApptDetail {
  id: number;
  date: string;
  time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  cancellation_reason: string | null;
  notes: string | null;
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

interface Consultation {
  id: number;
  appointment_id: number;
  diagnosis: string | null;
  treatment: string | null;
  prescription: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt12(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Shared classes ──────────────────────────────────────────────────────────

const textareaCls =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition resize-none";

const labelCls = "block text-sm font-semibold text-slate-700";

// ── Component ──────────────────────────────────────────────────────────────

export default function DoctorAppointmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const apptId = Number(params.id);

  const [appt,          setAppt]          = useState<ApptDetail | null>(null);
  const [apptLoading,   setApptLoading]   = useState(true);
  const [apptError,     setApptError]     = useState<string | null>(null);

  const [consult,          setConsult]          = useState<Consultation | null>(null);
  const [consultLoading,   setConsultLoading]   = useState(true);

  const [diagnosis,    setDiagnosis]    = useState("");
  const [treatment,    setTreatment]    = useState("");
  const [prescription, setPrescription] = useState("");
  const [clinicNotes,  setClinicNotes]  = useState("");

  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  // ── Load appointment ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!apptId) return;
    (async () => {
      setApptLoading(true);
      try {
        const res  = await fetch(`/api/appointments/${apptId}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load appointment");
        setAppt(json.data);
      } catch (e) {
        setApptError(e instanceof Error ? e.message : "Error");
      } finally {
        setApptLoading(false);
      }
    })();
  }, [apptId]);

  // ── Load consultation ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!apptId) return;
    (async () => {
      setConsultLoading(true);
      try {
        const res  = await fetch(`/api/consultations?appointment_id=${apptId}`, { credentials: "include" });
        const json = await res.json();
        if (!res.ok) return;
        const c: Consultation | null = json.data;
        setConsult(c);
        if (c) {
          setDiagnosis(c.diagnosis    ?? "");
          setTreatment(c.treatment    ?? "");
          setPrescription(c.prescription ?? "");
          setClinicNotes(c.notes      ?? "");
        }
      } finally {
        setConsultLoading(false);
      }
    })();
  }, [apptId]);

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/consultations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: apptId,
          diagnosis:    diagnosis    || null,
          treatment:    treatment    || null,
          prescription: prescription || null,
          notes:        clinicNotes  || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setConsult(json.data);
      showToast("Notes saved ✓");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const canEditNotes = appt?.status === "checked_in" || appt?.status === "completed";

  // ── Loading ───────────────────────────────────────────────────────────────

  if (apptLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/10 flex items-center justify-center">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (apptError || !appt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/10">
        <main className="mx-auto max-w-2xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{apptError ?? "Appointment not found"}</p>
            <button onClick={() => router.back()} className="mt-3 text-sm text-red-600 underline hover:text-red-800">
              ← Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/10">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Back */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <Link
            href="/doctor"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors mb-6"
          >
            ← Back to appointments
          </Link>
        </motion.div>

        {/* Appointment card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {appt.patient_first_name} {appt.patient_last_name}
              </h1>
              <p className="mt-0.5 text-sm text-slate-400">
                {fmtDate(appt.date)} · {fmt12(appt.time)} · {appt.duration_minutes} min
              </p>
            </div>
            <StatusBadge status={appt.status} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            {[
              { label: "Service",  value: appt.service_name },
              { label: "Fee",      value: `$${appt.price}` },
              { label: "Email",    value: appt.patient_email },
              ...(appt.patient_phone ? [{ label: "Phone", value: appt.patient_phone }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-0.5 font-medium text-slate-800 truncate">{value}</p>
              </div>
            ))}
          </div>

          {appt.cancellation_reason && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              <span className="font-semibold">Cancelled: </span>{appt.cancellation_reason}
            </div>
          )}
        </motion.div>

        {/* Grid: Consultation notes form (left) & Previous visits history (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Consultation notes card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Consultation Notes</h2>
                <p className="text-xs text-slate-400">Current visit clinical notes</p>
              </div>
              {consult && (
                <span className="text-xs text-slate-400">Updated {fmtDateTime(consult.updated_at)}</span>
              )}
            </div>

            {!canEditNotes ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
                <span className="font-semibold">Not available yet. </span>
                Notes can be added once the patient has been <strong>checked in</strong>.
              </div>
            ) : consultLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-5">

                <div>
                  <label className={labelCls}>Diagnosis</label>
                  <textarea
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    rows={3}
                    maxLength={5000}
                    placeholder="Clinical diagnosis or impression…"
                    className={textareaCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Treatment Plan</label>
                  <textarea
                    value={treatment}
                    onChange={(e) => setTreatment(e.target.value)}
                    rows={3}
                    maxLength={5000}
                    placeholder="Recommended treatment or procedures…"
                    className={textareaCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Prescription</label>
                  <textarea
                    value={prescription}
                    onChange={(e) => setPrescription(e.target.value)}
                    rows={3}
                    maxLength={5000}
                    placeholder="Medications, dosage, instructions…"
                    className={textareaCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    Private Notes
                    <span className="ml-1.5 text-xs font-normal text-slate-400">(only visible to you)</span>
                  </label>
                  <textarea
                    value={clinicNotes}
                    onChange={(e) => setClinicNotes(e.target.value)}
                    rows={3}
                    maxLength={5000}
                    placeholder="Additional clinical observations…"
                    className={textareaCls}
                  />
                </div>

                <AnimatePresence>
                  {saveError && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                    >
                      {saveError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-7 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 hover:shadow-lg disabled:opacity-60 transition-all cursor-pointer"
                  >
                    {saving ? "Saving…" : consult ? "Update Notes" : "Save Notes"}
                  </button>
                </div>
              </form>
            )}
          </motion.div>

          {/* Previous visits column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="lg:col-span-5"
          >
            <PreviousVisits
              appointmentId={apptId}
              patientName={`${appt.patient_first_name} ${appt.patient_last_name}`}
              onApplyDiagnosis={(d) => setDiagnosis((prev) => (prev ? `${prev}\n${d}` : d))}
              onApplyTreatment={(t) => setTreatment((prev) => (prev ? `${prev}\n${t}` : t))}
              onApplyPrescription={(p) => setPrescription((prev) => (prev ? `${prev}\n${p}` : p))}
            />
          </motion.div>
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0,  x: "-50%" }}
            exit={{   opacity: 0, y: 20,  x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-50 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
