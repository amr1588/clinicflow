"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ApiResponse,
  CreatedAppointment,
  DoctorDetail,
  SlotsResponse,
  User,
} from "@/types";

// "10:00" -> "10:00 AM"
function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Date -> "2026-10-22" using the LOCAL date (toISOString would use UTC)
function toDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateNice(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function BookingFlow() {
  const router = useRouter();
  const params = useSearchParams();

  // The URL is the source of truth for the selection
  const doctorId = params.get("doctor") ?? "";
  const serviceId = params.get("service") ?? "";
  const date = params.get("date") ?? "";
  const time = params.get("time") ?? "";

  const [reason, setReason] = useState(params.get("reason") ?? "");

  const [doctors, setDoctors] = useState<DoctorDetail[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [userChecked, setUserChecked] = useState(false);

  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [booked, setBooked] = useState<CreatedAppointment | null>(null);

  const selectedDoctor = doctors.find((d) => String(d.id) === doctorId);
  const selectedService = selectedDoctor?.services.find(
    (s) => String(s.id) === serviceId,
  );

  const today = new Date();
  const minDate = toDateString(today);
  const maxDate = toDateString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90),
  );

  // Update the URL without adding history entries
  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("reason"); // only used to carry the text through a login redirect
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.replace(`/book?${next.toString()}`, { scroll: false });
  };

  // Load doctors (each doctor comes with its services)
  useEffect(() => {
    let cancelled = false;

    const loadDoctors = async () => {
      try {
        setDoctorsLoading(true);
        setPageError(null);

        const res = await fetch("/api/doctors", { credentials: "include" });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(
            errData?.error || "Could not reach the server. Please try again.",
          );
        }

        const json: ApiResponse<DoctorDetail[]> = await res.json();
        if (!cancelled) setDoctors(json.data);
      } catch (err) {
        if (!cancelled) {
          setPageError(
            err instanceof Error ? err.message : "Something went wrong",
          );
        }
      } finally {
        if (!cancelled) setDoctorsLoading(false);
      }
    };

    loadDoctors();
    return () => {
      cancelled = true;
    };
  }, []);

  // Who is logged in? (401 just means "not logged in")
  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const json: ApiResponse<User> = await res.json();
          if (!cancelled) setUser(json.data);
        }
      } catch {
        // ignore: treated as logged out
      } finally {
        if (!cancelled) setUserChecked(true);
      }
    };

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load available times whenever doctor, service, or date changes
  const readyForSlots = Boolean(selectedDoctor && selectedService && date);

  useEffect(() => {
    if (!readyForSlots) {
      setSlots([]);
      setSlotsLoaded(false);
      setSlotsError(null);
      return;
    }

    let cancelled = false;

    const loadSlots = async () => {
      try {
        setSlotsLoading(true);
        setSlotsLoaded(false);
        setSlotsError(null);

        const query = new URLSearchParams({
          doctor: doctorId,
          service: serviceId,
          date,
        });
        const res = await fetch(`/api/appointments/slots?${query}`, {
          credentials: "include",
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Failed to load available times");
        }

        const json: ApiResponse<SlotsResponse> = await res.json();
        if (!cancelled) {
          setSlots(json.data.slots);
          setSlotsLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setSlots([]);
          setSlotsError(
            err instanceof Error ? err.message : "Something went wrong",
          );
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    };

    loadSlots();
    return () => {
      cancelled = true;
    };
  }, [readyForSlots, doctorId, serviceId, date, refreshKey]);

  // A time from the URL only counts if it is still in the free list
  const selectedTime = slotsLoaded && slots.includes(time) ? time : "";
  const timeNoLongerAvailable =
    slotsLoaded && time !== "" && !slots.includes(time);

  const goToLogin = () => {
    const query = new URLSearchParams({
      doctor: doctorId,
      service: serviceId,
      date,
      time,
    });
    if (reason.trim() !== "") query.set("reason", reason.trim().slice(0, 500));
    const next = `/book?${query.toString()}`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
  };

  const handleConfirm = async () => {
    setSubmitError(null);

    // Not logged in: send them to login, then bring them back here
    if (!user) {
      goToLogin();
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: Number(doctorId),
          service_id: Number(serviceId),
          date,
          time: selectedTime,
          reason: reason.trim(),
        }),
      });

      if (res.status === 401) {
        goToLogin();
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (res.status === 409) {
          // Someone else took the slot: refresh the free times
          setRefreshKey((k) => k + 1);
        }
        throw new Error(errData?.error || "Could not create the appointment");
      }

      const json: ApiResponse<CreatedAppointment> = await res.json();
      setBooked(json.data);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cardClass =
    "rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm";
  const optionClass = (active: boolean) =>
    `rounded-xl border px-4 py-3 text-left text-sm transition ${
      active
        ? "border-blue-600 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
    }`;

  // ----- Success screen -----
  if (booked && selectedDoctor && selectedService) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
            ✓
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Appointment requested
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Your appointment is <strong>pending</strong>. The clinic will
            confirm it shortly.
          </p>

          <div className="mt-6 space-y-1 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-700">
            <p>
              <span className="text-slate-400">Doctor: </span>
              Dr. {selectedDoctor.first_name} {selectedDoctor.last_name}
            </p>
            <p>
              <span className="text-slate-400">Service: </span>
              {selectedService.name}
            </p>
            <p>
              <span className="text-slate-400">Date: </span>
              {formatDateNice(booked.date)}
            </p>
            <p>
              <span className="text-slate-400">Time: </span>
              {formatTime(booked.time)}
            </p>
          </div>

          <Link
            href="/patient/appointments"
            className="mt-6 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Back to doctors
          </Link>
        </div>
      </main>
    );
  }

  // ----- Loading / error for the doctors list -----
  if (doctorsLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        </div>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">{pageError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-red-600 underline underline-offset-2 hover:text-red-800"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const canConfirm =
    Boolean(selectedDoctor && selectedService && date && selectedTime) &&
    !submitting &&
    (!user || user.role === "patient");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Book an appointment
      </h1>
      <p className="mt-2 text-base text-slate-500">
        Choose a doctor, a service, and a time that suits you.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: the steps */}
        <div className="space-y-6 lg:col-span-2">
          {/* 1. Doctor */}
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-900">1. Doctor</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {doctors.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    const keepService = d.services.some(
                      (s) => String(s.id) === serviceId,
                    );
                    setParams({
                      doctor: String(d.id),
                      service: keepService ? serviceId : null,
                      time: null,
                    });
                  }}
                  className={optionClass(String(d.id) === doctorId)}
                >
                  <span className="block font-medium">
                    Dr. {d.first_name} {d.last_name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {d.specialty}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 2. Service */}
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-900">2. Service</h2>
            {!selectedDoctor ? (
              <p className="mt-3 text-sm text-slate-500">
                Choose a doctor first.
              </p>
            ) : selectedDoctor.services.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                This doctor has no services available yet.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {selectedDoctor.services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setParams({ service: String(s.id), time: null })
                    }
                    className={optionClass(String(s.id) === serviceId)}
                  >
                    <span className="block font-medium">{s.name}</span>
                    <span className="block text-xs text-slate-500">
                      EGP {parseFloat(s.price).toFixed(0)} ·{" "}
                      {s.duration_minutes} min
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 3. Date and time */}
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-900">
              3. Date and time
            </h2>

            {!selectedService ? (
              <p className="mt-3 text-sm text-slate-500">
                Choose a doctor and a service first.
              </p>
            ) : (
              <>
                <input
                  type="date"
                  value={date}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) =>
                    setParams({ date: e.target.value, time: null })
                  }
                  className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />

                {date && (
                  <div className="mt-5">
                    {slotsLoading && (
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                        Loading available times…
                      </div>
                    )}

                    {slotsError && (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {slotsError}
                      </p>
                    )}

                    {!slotsLoading &&
                      !slotsError &&
                      slotsLoaded &&
                      slots.length === 0 && (
                        <p className="text-sm text-slate-500">
                          No available times on this date. Please try another
                          day.
                        </p>
                      )}

                    {timeNoLongerAvailable && (
                      <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        The time you selected is no longer available. Please
                        choose another.
                      </p>
                    )}

                    {!slotsLoading && slots.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setParams({ time: s })}
                            className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                              s === selectedTime
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                            }`}
                          >
                            {formatTime(s)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* 4. Reason */}
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-900">
              4. Reason for visit{" "}
              <span className="text-sm font-normal text-slate-400">
                (optional)
              </span>
            </h2>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Recurring tooth pain"
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </section>
        </div>

        {/* Right: summary */}
        <aside className="lg:col-span-1">
          <div className={`${cardClass} lg:sticky lg:top-24`}>
            <h2 className="text-lg font-semibold text-slate-900">Summary</h2>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-400">Doctor</dt>
                <dd className="font-medium text-slate-900">
                  {selectedDoctor
                    ? `Dr. ${selectedDoctor.first_name} ${selectedDoctor.last_name}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Service</dt>
                <dd className="font-medium text-slate-900">
                  {selectedService ? selectedService.name : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Date</dt>
                <dd className="font-medium text-slate-900">
                  {date ? formatDateNice(date) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Time</dt>
                <dd className="font-medium text-slate-900">
                  {selectedTime ? formatTime(selectedTime) : "—"}
                </dd>
              </div>
              {selectedService && (
                <div className="border-t border-slate-100 pt-3">
                  <dt className="text-slate-400">Price</dt>
                  <dd className="font-semibold text-slate-900">
                    EGP {parseFloat(selectedService.price).toFixed(0)}
                  </dd>
                </div>
              )}
            </dl>

            {submitError && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </p>
            )}

            {user && user.role !== "patient" && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Only patient accounts can book appointments.
              </p>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || !userChecked}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Booking…"
                : user
                  ? "Confirm appointment"
                  : "Continue to log in"}
            </button>

            {userChecked && !user && (
              <p className="mt-3 text-center text-xs text-slate-400">
                You&apos;ll be asked to log in or register. Your selection is
                kept.
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

// useSearchParams() must be inside a Suspense boundary
export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <BookingFlow />
    </Suspense>
  );
}
