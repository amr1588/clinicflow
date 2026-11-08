"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ApiResponse, DoctorDetail } from "@/types";

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// "09:00:00" -> "9:00 AM"
function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function DoctorDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/doctors/${id}`, { credentials: "include" });

        if (res.status === 404) {
          throw new Error("Doctor not found");
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Failed to load doctor");
        }

        const json: ApiResponse<DoctorDetail> = await res.json();
        setDoctor(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchDoctor();
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-sm text-slate-500">Loading doctor…</p>
        </div>
      </main>
    );
  }

  if (error || !doctor) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">{error ?? "Doctor not found"}</p>
          <Link
            href="/doctors"
            className="mt-3 inline-block text-sm text-red-600 underline underline-offset-2 hover:text-red-800"
          >
            Back to doctors
          </Link>
        </div>
      </main>
    );
  }

  const workingHours = doctor.working_hours ?? [];

  // Group working hours by day, so a day with two blocks shows on one row
  const hoursByDay: Record<number, string[]> = {};
  for (const wh of workingHours) {
    (hoursByDay[wh.day_of_week] ??= []).push(
      `${formatTime(wh.start_time)} – ${formatTime(wh.end_time)}`
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/doctors"
        className="text-sm font-medium text-slate-500 hover:text-blue-600"
      >
        ← All doctors
      </Link>

      {/* Header card */}
      <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-xl font-bold text-white shadow-md shadow-blue-500/20">
              {doctor.first_name[0]}
              {doctor.last_name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Dr. {doctor.first_name} {doctor.last_name}
              </h1>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {doctor.specialty}
              </span>
            </div>
          </div>

          <Link
            href={`/book?doctor=${doctor.id}`}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-center text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:shadow-lg"
          >
            Book appointment
          </Link>
        </div>

        {doctor.bio && (
          <p className="mt-6 text-sm leading-relaxed text-slate-600">
            {doctor.bio}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-6 border-t border-slate-100 pt-5 text-sm">
          <div>
            <p className="text-slate-400">Consultation fee</p>
            <p className="font-semibold text-slate-900">
              EGP {parseFloat(doctor.consultation_fee).toFixed(0)}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Duration</p>
            <p className="font-semibold text-slate-900">
              {doctor.consultation_duration} min
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Services */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Services</h2>

          {doctor.services.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No services listed for this doctor yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {doctor.services.map((svc) => (
                <li key={svc.id}>
                  <Link
                    href={`/book?doctor=${doctor.id}&service=${svc.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm transition hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <span className="font-medium text-slate-800">{svc.name}</span>
                    <span className="text-slate-500">
                      EGP {parseFloat(svc.price).toFixed(0)} · {svc.duration_minutes} min
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Working hours */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Working hours</h2>

          {workingHours.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Working hours not available yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {dayNames.map((name, index) => (
                <li key={name} className="flex justify-between">
                  <span className="text-slate-600">{name}</span>
                  <span
                    className={
                      hoursByDay[index]
                        ? "font-medium text-slate-900"
                        : "text-slate-400"
                    }
                  >
                    {hoursByDay[index] ? hoursByDay[index].join(", ") : "Closed"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}