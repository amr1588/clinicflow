"use client";

import React, { useEffect, useState } from "react";
import type { Service, ApiResponse } from "@/types";

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/services", { credentials: "include" });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Failed to load services");
        }

        const json: ApiResponse<Service[]> = await res.json();
        setServices(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Our Services
        </h1>
        <p className="mt-2 text-base text-slate-500">
          Everything we offer, with clear prices and durations.
        </p>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-sm text-slate-500">Loading services…</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-red-600 underline underline-offset-2 hover:text-red-800"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && services.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold text-slate-700">
            No services available
          </h2>
          <p className="mt-1 text-sm text-slate-500">Please check back later.</p>
        </div>
      )}

      {!loading && !error && services.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {service.name}
              </h2>

              {service.description && (
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-500">
                  {service.description}
                </p>
              )}

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                <span className="font-semibold text-slate-900">
                  EGP {parseFloat(service.price).toFixed(0)}
                </span>
                <span className="text-slate-500">
                  ⏱ {service.duration_minutes} min
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}