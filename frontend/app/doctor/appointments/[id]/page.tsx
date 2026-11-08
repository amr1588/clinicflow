"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

// ── Component ──────────────────────────────────────────────────────────────

export default function DoctorAppointmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const apptId = Number(params.id);

  // Appointment
  const [appt, setAppt] = useState<ApptDetail | null>(null);
  const [apptLoading, setApptLoading] = useState(true);
  const [apptError, setApptError] = useState<string | null>(null);

  // Consultation notes
  const [consult, setConsult] = useState<Consultation | null>(null);
  const [consultLoading, setConsultLoading] = useState(true);

  // Form state
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [prescription, setPrescription] = useState("");
  const [clinicNotes, setClinicNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ── Load appointment ────────────────────────────────────────────────────

  useEffect(() => {
    if (!apptId) return;
    let cancelled = false;

    (async () => {
      setApptLoading(true);
      setApptError(null);
      try {
        const res = await fetch(`/api/appointments/${apptId}`, { credentials: "include" });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error ?? "Could not reach the server. Please try again.");
        }
        if (!cancelled) setAppt(json.data);
      } catch (e) {
        if (!cancelled) setApptError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setApptLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apptId]);

  // ── Load consultation notes ─────────────────────────────────────────────

  useEffect(() => {
    if (!apptId) return;
    let cancelled = false;

    (async () => {
      setConsultLoading(true);
      try {
        const res = await fetch(`/api/consultations?appointment_id=${apptId}`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Failed to load notes");

        const c: Consultation | null = json.data;
        if (cancelled) return;
        setConsult(c);
        // Pre-fill form if notes already exist
        if (c) {
          setDiagnosis(c.diagnosis ?? "");
          setTreatment(c.treatment ?? "");
          setPrescription(c.prescription ?? "");
          setClinicNotes(c.notes ?? "");
        }
      } catch {
        // If notes fail to load, the form will still appear empty. Not fatal.
      } finally {
        if (!cancelled) setConsultLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apptId]);

  // ── Save notes ──────────────────────────────────────────────────────────

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
          diagnosis: diagnosis || null,
          treatment: treatment || null,
          prescription: prescription || null,
          notes: clinicNotes || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to save");
      setConsult(json.data);
      showToast("Notes saved successfully");
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

  // ── Render ───────────────────────────────────────────────────────────────

  const canEditNotes =
    appt?.status === "checked_in" || appt?.status === "completed";

  if (apptLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (apptError || !appt) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{apptError ?? "Appointment not found"}</p>
          <button
            onClick={() => router.back()}
            className="mt-3 text-sm text-red-600 underline hover:text-red-800"
          >
            ← Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

      {/* Back link */}
      <Link
        href="/doctor"
        className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        ← Back to appointments
      </Link>

      {/* Appointment summary card */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {appt.patient_first_name} {appt.patient_last_name}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {fmtDate(appt.date)} · {fmt12(appt.time)} · {appt.duration_minutes} min
            </p>
          </div>
          <StatusBadge status={appt.status} />
        </div>

        <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Service</dt>
            <dd className="mt-0.5 text-slate-700">{appt.service_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fee</dt>
            <dd className="mt-0.5 text-slate-700">EGP {parseFloat(appt.price).toFixed(0)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</dt>
            <dd className="mt-0.5 text-slate-700">{appt.patient_email}</dd>
          </div>
          {appt.patient_phone && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</dt>
              <dd className="mt-0.5 text-slate-700">{appt.patient_phone}</dd>
            </div>
          )}
          {appt.cancellation_reason && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cancellation reason</dt>
              <dd className="mt-0.5 text-slate-500 italic">&ldquo;{appt.cancellation_reason}&rdquo;</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Consultation notes */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">Consultation Notes</h2>
          {consult && (
            <span className="text-xs text-slate-400">
              Last updated {fmtDateTime(consult.updated_at)}
            </span>
          )}
        </div>

        {!canEditNotes ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Consultation notes are available once the patient has been <strong>checked in</strong>.
          </div>
        ) : consultLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">

            {/* Diagnosis */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Diagnosis
              </label>
              <textarea
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Clinical diagnosis or impression…"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Treatment */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Treatment Plan
              </label>
              <textarea
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Recommended treatment or procedures…"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Prescription */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Prescription
              </label>
              <textarea
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Medications, dosage, and instructions…"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Private notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Private Notes
                <span className="ml-1.5 text-xs font-normal text-slate-400">(only visible to you)</span>
              </label>
              <textarea
                value={clinicNotes}
                onChange={(e) => setClinicNotes(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Any additional clinical observations…"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 transition-colors"
              >
                {saving ? "Saving…" : consult ? "Update Notes" : "Save Notes"}
              </button>
            </div>
          </form>
        )}

        {/* Previous visits of the same patient (this doctor's own notes only).
            Shown even before check-in, so the doctor can review history first. */}
        <PreviousVisits appointmentId={appt.id} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          ✓ {toast}
        </div>
      )}
    </main>
  );
}