"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { DoctorDetail, ApiResponse } from "@/types";
import PendingOverlay from "@/components/PendingOverlay";

/**
 * Doctors List Page — Public
 * Fetches all active doctors from the API and displays them as cards.
 * Uses inline fetch (no shared wrapper) per project conventions.
 */
export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/doctors", {
          credentials: "include",
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to load doctors");
        }

        const json: ApiResponse<DoctorDetail[]> = await res.json();
        setDoctors(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  // Day labels for working hours
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">

      {/* Page Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Our Doctors
          </h1>
          <p className="mt-2 text-slate-500 text-base">
            Meet our experienced medical professionals. Book a consultation
            with the specialist that fits your needs.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="mt-4 text-slate-500 text-sm">Loading doctors…</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-red-500 text-xl">!</span>
            </div>
            <p className="text-red-700 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 text-sm text-red-600 hover:text-red-800 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && doctors.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🩺</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-700">
              No doctors available
            </h2>
            <p className="mt-1 text-slate-500 text-sm">
              Please check back later.
            </p>
          </div>
        )}

        {/* Doctors grid */}
        {!loading && !error && doctors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {doctors.map((doctor) => (
              <Link
                key={doctor.id}
                href={`/doctors/${doctor.id}`}
                className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 hover:border-blue-200 transition-all duration-300 overflow-hidden"
              >
                <PendingOverlay />
                <div className="p-6">
                  {/* Doctor header */}
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                      {doctor.first_name[0]}
                      {doctor.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        Dr. {doctor.first_name} {doctor.last_name}
                      </h2>
                      <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {doctor.specialty}
                      </span>
                    </div>
                  </div>

                  {/* Bio preview */}
                  {doctor.bio && (
                    <p className="mt-4 text-slate-500 text-sm leading-relaxed line-clamp-2">
                      {doctor.bio}
                    </p>
                  )}

                  {/* Details row */}
                  <div className="mt-4 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="text-emerald-500 font-semibold">$</span>
                      <span>
                        {parseFloat(doctor.consultation_fee).toFixed(0)}{" "}
                        <span className="text-slate-400">consultation</span>
                      </span>
                    </div>
                    <span className="text-slate-200">|</span>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="text-blue-400">⏱</span>
                      <span>
                        {doctor.consultation_duration} min
                      </span>
                    </div>
                  </div>

                  {/* Services */}
                  {doctor.services.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {doctor.services.map((svc) => (
                        <span
                          key={svc.id}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 text-xs font-medium border border-slate-100"
                        >
                          {svc.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Click to view full profile
                  </span>
                  <span className="text-blue-500 text-sm font-medium group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
