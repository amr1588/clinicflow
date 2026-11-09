"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ApiResponse, ConsultationHistoryItem } from "@/types";

interface PreviousVisitsProps {
  appointmentId: number;
  patientName?: string;
  onApplyDiagnosis?: (val: string) => void;
  onApplyTreatment?: (val: string) => void;
  onApplyPrescription?: (val: string) => void;
}

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
    month: "short",
    year: "numeric",
  });
}

export default function PreviousVisits({
  appointmentId,
  patientName,
  onApplyDiagnosis,
  onApplyTreatment,
  onApplyPrescription,
}: PreviousVisitsProps) {
  const [visits, setVisits] = useState<ConsultationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/consultations/history?appointment_id=${appointmentId}`,
          { credentials: "include" }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(
            errData?.error || "Could not reach the server. Please try again."
          );
        }

        const json: ApiResponse<ConsultationHistoryItem[]> = await res.json();
        if (!cancelled) {
          setVisits(json.data);
          // Expand the most recent previous visit by default
          if (json.data.length > 0) {
            setExpandedId(json.data[0].id);
          }
        }
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
  }, [appointmentId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold">
            📋
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Patient Medical History
            </h3>
            <p className="text-xs text-slate-400">
              {patientName ? `Previous notes for ${patientName}` : "Past consultations and notes"}
            </p>
          </div>
        </div>

        {!loading && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
            {visits.length} {visits.length === 1 ? "past visit" : "past visits"}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-3 text-sm text-slate-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
          <span>Loading patient history…</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && visits.length === 0 && (
        <div className="py-10 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-xl text-slate-400">
            🩺
          </div>
          <p className="text-sm font-semibold text-slate-800">No previous visits found</p>
          <p className="mt-1 text-xs text-slate-400 max-w-xs mx-auto">
            This patient has no recorded consultation notes from prior visits. Notes added here will appear on their next visit.
          </p>
        </div>
      )}

      {/* Visits list */}
      {!loading && !error && visits.length > 0 && (
        <div className="mt-4 space-y-3">
          {visits.map((v, idx) => {
            const isExpanded = expandedId === v.id;
            const doctorName =
              v.doctor_first_name && v.doctor_last_name
                ? `Dr. ${v.doctor_first_name} ${v.doctor_last_name}`
                : null;

            return (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.04 }}
                className={`overflow-hidden rounded-xl border transition-all ${
                  isExpanded
                    ? "border-emerald-300 bg-slate-50/70 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {/* Visit summary header (collapsible) */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {formatDateNice(v.date)}
                      </span>
                      <span className="text-xs text-slate-400">· {formatTime(v.time)}</span>
                      {idx === 0 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Most recent
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">{v.service_name}</span>
                      {doctorName && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500">{doctorName}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <span className="ml-2 text-xs font-semibold text-emerald-600">
                    {isExpanded ? "Hide ▲" : "View Details ▼"}
                  </span>
                </button>

                {/* Visit details content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-200/80 px-4 pb-4 pt-3 space-y-3"
                    >
                      {/* Diagnosis */}
                      {v.diagnosis ? (
                        <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-2xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              <span>🩺</span> Diagnosis
                            </span>
                            {onApplyDiagnosis && (
                              <button
                                type="button"
                                onClick={() => onApplyDiagnosis(v.diagnosis!)}
                                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                              >
                                Copy to form →
                              </button>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-slate-800">
                            {v.diagnosis}
                          </p>
                        </div>
                      ) : null}

                      {/* Treatment */}
                      {v.treatment ? (
                        <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-2xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                              <span>📋</span> Treatment Plan
                            </span>
                            {onApplyTreatment && (
                              <button
                                type="button"
                                onClick={() => onApplyTreatment(v.treatment!)}
                                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                              >
                                Copy to form →
                              </button>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-slate-800">
                            {v.treatment}
                          </p>
                        </div>
                      ) : null}

                      {/* Prescription */}
                      {v.prescription ? (
                        <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 shadow-2xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                              <span>💊</span> Prescription
                            </span>
                            {onApplyPrescription && (
                              <button
                                type="button"
                                onClick={() => onApplyPrescription(v.prescription!)}
                                className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                              >
                                Copy to form →
                              </button>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap text-sm font-medium text-slate-800">
                            {v.prescription}
                          </p>
                        </div>
                      ) : null}

                      {/* Private Notes */}
                      {v.notes ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 shadow-2xs">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-1">
                            <span>🔒</span> Clinical Notes
                          </span>
                          <p className="whitespace-pre-wrap text-sm text-slate-700">
                            {v.notes}
                          </p>
                        </div>
                      ) : null}

                      {!v.diagnosis && !v.treatment && !v.prescription && !v.notes && (
                        <p className="text-xs italic text-slate-400">
                          No written clinical notes recorded for this visit.
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
