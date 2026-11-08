"use client";

import React, { useEffect, useState } from "react";
import type { ApiResponse, ConsultationHistoryItem } from "@/types";

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

const fields: { key: "diagnosis" | "treatment" | "prescription" | "notes"; label: string }[] = [
  { key: "diagnosis", label: "Diagnosis" },
  { key: "treatment", label: "Treatment" },
  { key: "prescription", label: "Prescription" },
  { key: "notes", label: "Notes" },
];

const INITIAL_VISIBLE = 3;

export default function PreviousVisits({ appointmentId }: { appointmentId: number }) {
  const [visits, setVisits] = useState<ConsultationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setShowAll(false);

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
        if (!cancelled) setVisits(json.data);
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

  const shown = showAll ? visits : visits.slice(0, INITIAL_VISIBLE);

  return (
    <section className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="text-base font-semibold text-slate-900">Previous visits</h3>

      {loading && (
        <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
          Loading history…
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && visits.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">
          No previous notes for this patient.
        </p>
      )}

      {!loading && !error && visits.length > 0 && (
        <>
          <ul className="mt-3 space-y-3">
            {shown.map((v) => (
              <li
                key={v.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDateNice(v.date)} · {formatTime(v.time)}
                  </p>
                  <p className="text-xs text-slate-500">{v.service_name}</p>
                </div>

                <dl className="mt-2 space-y-1.5 text-sm">
                  {fields.map(
                    (f) =>
                      v[f.key] && (
                        <div key={f.key}>
                          <dt className="text-xs text-slate-400">{f.label}</dt>
                          <dd className="whitespace-pre-wrap text-slate-700">
                            {v[f.key]}
                          </dd>
                        </div>
                      )
                  )}
                </dl>
              </li>
            ))}
          </ul>

          {visits.length > INITIAL_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="mt-3 text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              {showAll
                ? "Show fewer"
                : `Show older visits (${visits.length - INITIAL_VISIBLE})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}