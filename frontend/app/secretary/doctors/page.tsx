"use client";

import React, { useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Doctor {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  specialty: string;
  bio: string | null;
  consultation_fee: string;
  consultation_duration: number;
  is_active: number;
  services: { id: number; name: string }[];
}

interface Service {
  id: number;
  name: string;
  duration_minutes: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_HOURS = DAYS.map((_, i) => ({
  day_of_week: i,
  start_time: "09:00",
  end_time: "17:00",
  enabled: i >= 1 && i <= 5, // Mon–Fri on by default
}));

// ── Component ──────────────────────────────────────────────────────────────

export default function SecretaryDoctorsPage() {
  const [doctors,  setDoctors]  = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Create doctor form
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    specialty: "", bio: "", consultation_fee: "", consultation_duration: "30",
    password: "", service_ids: [] as number[],
    working_hours: DEFAULT_HOURS,
  });

  // Toggle loading
  const [toggling, setToggling] = useState<number | null>(null);
  const [toast,    setToast]    = useState<string | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────

  async function loadDoctors() {
    setLoading(true);
    setError(null);
    try {
      // Secretary needs all doctors (including inactive); hack: reuse GET /doctors
      // which only returns active ones — for now that's fine for this phase.
      const [drRes, svcRes] = await Promise.all([
        fetch("/api/doctors",  { credentials: "include" }),
        fetch("/api/services", { credentials: "include" }),
      ]);
      const drJson  = await drRes.json();
      const svcJson = await svcRes.json();
      if (!drRes.ok)  throw new Error(drJson.error  ?? "Failed to load doctors");
      if (!svcRes.ok) throw new Error(svcJson.error ?? "Failed to load services");
      setDoctors(drJson.data);
      setServices(svcJson.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDoctors(); }, []);

  // ── Toggle active ────────────────────────────────────────────────────────

  async function toggleActive(doctor: Doctor) {
    setToggling(doctor.id);
    try {
      const res  = await fetch(`/api/doctors/${doctor.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: doctor.is_active ? 0 : 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setDoctors((prev) =>
        prev.map((d) =>
          d.id === doctor.id ? { ...d, is_active: doctor.is_active ? 0 : 1 } : d
        )
      );
      showToast(doctor.is_active ? "Doctor deactivated" : "Doctor activated");
    } catch (e) {
      showToast("Error: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setToggling(null);
    }
  }

  // ── Create doctor ────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const wh = form.working_hours
        .filter((d) => d.enabled)
        .map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time }));

      const body = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || undefined,
        specialty: form.specialty,
        bio: form.bio || undefined,
        consultation_fee: parseFloat(form.consultation_fee) || 0,
        consultation_duration: parseInt(form.consultation_duration) || 30,
        password: form.password,
        service_ids: form.service_ids,
        working_hours: wh,
      };

      // POST /doctors
      const res  = await fetch("/api/doctors", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create doctor");

      const doctorId = json.data.id;

      // PATCH working hours + services (they were just created with POST)
      // The POST already sets the basic profile; now update services + hours
      await fetch(`/api/doctors/${doctorId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_ids: form.service_ids, working_hours: wh }),
      });

      setShowForm(false);
      showToast("Doctor created successfully");
      loadDoctors();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function toggleService(id: number) {
    setForm((f) => ({
      ...f,
      service_ids: f.service_ids.includes(id)
        ? f.service_ids.filter((s) => s !== id)
        : [...f.service_ids, id],
    }));
  }

  function toggleDay(idx: number) {
    setForm((f) => ({
      ...f,
      working_hours: f.working_hours.map((d, i) =>
        i === idx ? { ...d, enabled: !d.enabled } : d
      ),
    }));
  }

  function updateHour(idx: number, field: "start_time" | "end_time", val: string) {
    setForm((f) => ({
      ...f,
      working_hours: f.working_hours.map((d, i) =>
        i === idx ? { ...d, [field]: val } : d
      ),
    }));
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Doctors</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {doctors.length} doctor{doctors.length !== 1 ? "s" : ""} in the system
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          + Add Doctor
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      )}

      {/* Doctors grid */}
      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <div
              key={d.id}
              className={`rounded-xl border bg-white p-5 shadow-sm transition-opacity ${
                d.is_active ? "border-slate-200" : "border-slate-100 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">
                    Dr. {d.first_name} {d.last_name}
                  </p>
                  <p className="text-sm text-blue-600">{d.specialty}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    d.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {d.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="mt-3 space-y-0.5 text-xs text-slate-500">
                <p>{d.email}</p>
                {d.phone && <p>{d.phone}</p>}
                <p>Fee: ${d.consultation_fee} · {d.consultation_duration} min</p>
              </div>

              {d.services.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {d.services.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={() => toggleActive(d)}
                disabled={toggling === d.id}
                className={`mt-4 w-full rounded-lg border py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  d.is_active
                    ? "border-red-200 text-red-600 hover:bg-red-50"
                    : "border-green-200 text-green-600 hover:bg-green-50"
                }`}
              >
                {toggling === d.id
                  ? "Saving…"
                  : d.is_active
                  ? "Deactivate"
                  : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create doctor modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={handleCreate}
            className="my-8 w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl"
          >
            <h2 className="mb-6 text-xl font-bold text-slate-900">Add New Doctor</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "First name *", key: "first_name", type: "text" },
                { label: "Last name *",  key: "last_name",  type: "text" },
                { label: "Email *",      key: "email",      type: "email" },
                { label: "Phone",        key: "phone",      type: "tel" },
                { label: "Specialty *",  key: "specialty",  type: "text" },
                { label: "Consult. fee (USD) *", key: "consultation_fee", type: "number" },
                { label: "Consult. duration (min) *", key: "consultation_duration", type: "number" },
                { label: "Temp. password *", key: "password", type: "password" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700">{label}</label>
                  <input
                    type={type}
                    required={label.endsWith("*")}
                    value={(form as Record<string, unknown>)[key] as string}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 text-black px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              ))}
            </div>

            {/* Bio */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">Bio</label>
              <textarea
                rows={3}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                className="mt-1 w-full rounded-lg text-black border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Services */}
            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-slate-700">Services</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {services.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={form.service_ids.includes(s.id)}
                      onChange={() => toggleService(s.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">{s.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Working hours */}
            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-slate-700">Working Hours</legend>
              <div className="mt-2 space-y-2">
                {form.working_hours.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 text-black">
                    <label className="flex w-16 items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={() => toggleDay(i)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      {DAYS[d.day_of_week]}
                    </label>
                    {d.enabled && (
                      <>
                        <input
                          type="time"
                          value={d.start_time}
                          onChange={(e) => updateHour(i, "start_time", e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <span className="text-slate-400">–</span>
                        <input
                          type="time"
                          value={d.end_time}
                          onChange={(e) => updateHour(i, "end_time", e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>

            {formError && (
              <p className="mt-4 text-sm text-red-600">{formError}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create Doctor"}
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          ✓ {toast}
        </div>
      )}
    </main>
  );
}
