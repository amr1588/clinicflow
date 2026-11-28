"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import type { ScheduleConflict } from "@/types";

// ── Local types ──────────────────────────────────────────────────────────────

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
  photo_url: string | null;
  is_active: number;
  services: { id: number; name: string }[];
  working_hours?: { id?: number; day_of_week: number; start_time: string; end_time: string }[];
}

interface Service { id: number; name: string; duration_minutes: number; }

// ── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_HOURS = DAYS.map((_, i) => ({
  day_of_week: i,
  start_time: "09:00",
  end_time: "17:00",
  enabled: i >= 1 && i <= 5, // Mon–Fri on by default
}));

// ── Form state shape ─────────────────────────────────────────────────────────

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  specialty: string;
  bio: string;
  consultation_fee: string;
  consultation_duration: string;
  password: string;
  service_ids: number[];
  working_hours: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    enabled: boolean;
  }[];
}

const EMPTY_FORM: FormState = {
  first_name: "", last_name: "", email: "", phone: "",
  specialty: "", bio: "", consultation_fee: "", consultation_duration: "30",
  password: "", service_ids: [], working_hours: DEFAULT_HOURS,
};

// ── Tailwind helpers ──────────────────────────────────────────────────────────

const inputCls =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

// ── Main component ────────────────────────────────────────────────────────────

export default function SecretaryDoctorsPage() {
  const [doctors,  setDoctors]  = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Modal state: null = closed, "add" = new, number = edit doctor id
  const [modalMode, setModalMode] = useState<null | "add" | number>(null);
  const [formLoading, setFormLoading] = useState(false); // loading doctor data for edit
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);

  const [toggling, setToggling] = useState<number | null>(null);
  const [toast,    setToast]    = useState<string | null>(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  async function loadDoctors() {
    setLoading(true); setError(null);
    try {
      // Secretary-side: use a dedicated endpoint that returns ALL doctors (incl. inactive)
      // We call the same /api/doctors endpoint — the backend now returns inactive ones for secretaries
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

  // ── Open "Add" modal ───────────────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setConflicts([]);
    setModalMode("add");
  }

  // ── Open "Edit" modal — fetch full doctor detail first ────────────────────

  async function openEdit(doctorId: number) {
    setFormError(null);
    setConflicts([]);
    setModalMode(doctorId);   // opens modal immediately (shows spinner)
    setFormLoading(true);

    try {
      const res  = await fetch(`/api/doctors/${doctorId}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load doctor");

      const d: Doctor = json.data;

      // Build the working_hours form state from the fetched schedule.
      // Start with all 7 days disabled, then enable the ones in the response.
      const hoursMap: Record<number, { start_time: string; end_time: string }> = {};
      for (const wh of d.working_hours ?? []) {
        // Keep only HH:MM (strip seconds if present)
        hoursMap[wh.day_of_week] = {
          start_time: wh.start_time.slice(0, 5),
          end_time:   wh.end_time.slice(0, 5),
        };
      }

      const workingHoursForm = DAYS.map((_, i) => ({
        day_of_week: i,
        start_time:  hoursMap[i]?.start_time ?? "09:00",
        end_time:    hoursMap[i]?.end_time   ?? "17:00",
        enabled:     i in hoursMap,
      }));

      setForm({
        first_name:            d.first_name,
        last_name:             d.last_name,
        email:                 d.email,
        phone:                 d.phone ?? "",
        specialty:             d.specialty,
        bio:                   d.bio ?? "",
        consultation_fee:      d.consultation_fee,
        consultation_duration: String(d.consultation_duration),
        password:              "",           // never pre-filled for security
        service_ids:           d.services.map((s) => s.id),
        working_hours:         workingHoursForm,
      });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to load doctor data");
    } finally {
      setFormLoading(false);
    }
  }

  function closeModal() {
    setModalMode(null);
    setFormError(null);
    setConflicts([]);
  }

  // ── Toggle active/inactive ─────────────────────────────────────────────────

  async function toggleActive(doctor: Doctor) {
    setToggling(doctor.id);
    try {
      const res  = await fetch(`/api/doctors/${doctor.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: doctor.is_active ? 0 : 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setDoctors((prev) => prev.map((d) =>
        d.id === doctor.id ? { ...d, is_active: doctor.is_active ? 0 : 1 } : d
      ));
      showToast(doctor.is_active ? "Doctor deactivated" : "Doctor activated");
    } catch (e) {
      showToast("Error: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setToggling(null);
    }
  }

  // ── Create doctor ──────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null); setConflicts([]);
    try {
      const wh = form.working_hours
        .filter((d) => d.enabled)
        .map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time }));

      const body = {
        first_name:            form.first_name,
        last_name:             form.last_name,
        email:                 form.email,
        phone:                 form.phone || undefined,
        specialty:             form.specialty,
        bio:                   form.bio || undefined,
        consultation_fee:      parseFloat(form.consultation_fee) || 0,
        consultation_duration: parseInt(form.consultation_duration) || 30,
        password:              form.password,
      };

      const res  = await fetch("/api/doctors", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create doctor");

      // Set services + working hours in a second call
      await fetch(`/api/doctors/${json.data.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_ids: form.service_ids, working_hours: wh }),
      });

      closeModal();
      showToast("Doctor created successfully");
      loadDoctors();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  // ── Save edits ─────────────────────────────────────────────────────────────

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (typeof modalMode !== "number") return;
    setSaving(true); setFormError(null); setConflicts([]);

    const doctorId = modalMode;
    const wh = form.working_hours
      .filter((d) => d.enabled)
      .map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time }));

    try {
      const body: Record<string, unknown> = {
        first_name:            form.first_name,
        last_name:             form.last_name,
        phone:                 form.phone || null,
        specialty:             form.specialty,
        bio:                   form.bio || null,
        consultation_fee:      parseFloat(form.consultation_fee) || 0,
        consultation_duration: parseInt(form.consultation_duration) || 30,
        service_ids:           form.service_ids,
        working_hours:         wh,
      };

      const res  = await fetch(`/api/doctors/${doctorId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      // 409 = schedule conflicts — show them without closing the modal
      if (res.status === 409) {
        setConflicts(json.conflicts ?? []);
        setFormError(json.error ?? "Schedule conflict");
        return;
      }

      if (!res.ok) throw new Error(json.error ?? "Failed to save doctor");

      closeModal();
      showToast("Doctor updated successfully");
      loadDoctors();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  // ── Form helpers ───────────────────────────────────────────────────────────

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

  const isEditMode = typeof modalMode === "number";
  const isAddMode  = modalMode === "add";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/15 to-cyan-50/10">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Doctors</h1>
            <p className="mt-1 text-slate-500">
              {doctors.length} doctor{doctors.length !== 1 ? "s" : ""} in the system
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={openAdd}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:shadow-lg transition-all"
          >
            + Add Doctor
          </motion.button>
        </motion.div>

        {/* Page error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <div className="flex justify-center py-24">
            <div className="h-11 w-11 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          </div>
        )}

        {!loading && !error && doctors.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <p className="text-2xl mb-2">🩺</p>
            <p className="text-sm text-slate-500">No doctors yet — add one to get started.</p>
          </motion.div>
        )}

        {/* Doctors grid */}
        {!loading && !error && doctors.length > 0 && (
          <motion.div
            initial="hidden" animate="show"
            variants={{ show: { transition: { staggerChildren: 0.07 } } }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {doctors.map((d) => (
              <motion.div
                key={d.id}
                variants={cardVariants}
                className={`group rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all ${
                  d.is_active ? "border-slate-200" : "border-slate-100 opacity-60"
                }`}
              >
                {/* Doctor header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-700 font-bold text-sm mb-2">
                      {d.first_name[0]}{d.last_name[0]}
                    </div>
                    <p className="font-bold text-slate-900">Dr. {d.first_name} {d.last_name}</p>
                    <p className="text-sm font-medium text-blue-600">{d.specialty}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${
                    d.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {d.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-500 mb-4">
                  <p>{d.email}</p>
                  {d.phone && <p>{d.phone}</p>}
                  <p className="font-medium text-slate-600">
                    Fee: EGP {parseFloat(d.consultation_fee).toFixed(0)} · {d.consultation_duration} min
                  </p>
                </div>

                {d.services.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {d.services.map((s) => (
                      <span key={s.id} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {/* Edit button */}
                  <button
                    onClick={() => openEdit(d.id)}
                    className="flex-1 rounded-xl border border-blue-200 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                  >
                    ✏️ Edit
                  </button>
                  {/* Activate / Deactivate */}
                  <button
                    onClick={() => toggleActive(d)}
                    disabled={toggling === d.id}
                    className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition disabled:opacity-50 ${
                      d.is_active
                        ? "border-red-200 text-red-600 hover:bg-red-50"
                        : "border-green-200 text-green-600 hover:bg-green-50"
                    }`}
                  >
                    {toggling === d.id ? "Saving…" : d.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* ── Add / Edit doctor modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {(isAddMode || isEditMode) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{   opacity: 0, scale: 0.93, y: 20 }}
              transition={{ type: "spring", stiffness: 280, damping: 25 }}
              onSubmit={isAddMode ? handleCreate : handleEdit}
              className="my-8 w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl"
            >
              <h2 className="mb-6 text-xl font-bold text-slate-900">
                {isAddMode ? "Add New Doctor" : "Edit Doctor"}
              </h2>

              {/* Loading spinner while fetching doctor data for edit */}
              {isEditMode && formLoading && (
                <div className="flex justify-center py-16">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                </div>
              )}

              {/* Form fields — hidden while loading */}
              {!formLoading && (
                <>
                  {/* Basic info grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { label: "First name *", key: "first_name", type: "text" },
                      { label: "Last name *",  key: "last_name",  type: "text" },
                      { label: "Email *",      key: "email",      type: "email",    readOnly: isEditMode },
                      { label: "Phone",        key: "phone",      type: "tel" },
                      { label: "Specialty *",  key: "specialty",  type: "text" },
                      { label: "Fee (EGP) *",  key: "consultation_fee",      type: "number" },
                      { label: "Duration (min) *", key: "consultation_duration", type: "number" },
                      ...(isAddMode
                        ? [{ label: "Temp. password *", key: "password", type: "password", readOnly: false }]
                        : []),
                    ].map(({ label, key, type, readOnly }) => (
                      <div key={key}>
                        <label className="block text-sm font-semibold text-slate-700">{label}</label>
                        <input
                          type={type}
                          required={label.endsWith("*")}
                          readOnly={readOnly}
                          value={(form as Record<string, unknown>)[key] as string}
                          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                          placeholder={
                            key === "consultation_fee" ? "0.00" :
                            key === "consultation_duration" ? "30" : ""
                          }
                          className={`${inputCls} ${readOnly ? "bg-slate-50 cursor-not-allowed text-slate-500" : ""}`}
                        />
                        {key === "email" && isEditMode && (
                          <p className="mt-1 text-xs text-slate-400">Email cannot be changed after creation.</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Bio */}
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-slate-700">Bio</label>
                    <textarea
                      rows={3}
                      value={form.bio}
                      onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                      placeholder="Short professional bio…"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-none"
                    />
                  </div>

                  {/* Services */}
                  <fieldset className="mt-5">
                    <legend className="text-sm font-semibold text-slate-700 mb-2">Services</legend>
                    <div className="flex flex-wrap gap-2">
                      {services.map((s) => (
                        <label
                          key={s.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            form.service_ids.includes(s.id)
                              ? "border-blue-400 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                            checked={form.service_ids.includes(s.id)}
                            onChange={() => toggleService(s.id)}
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {/* Working hours */}
                  <fieldset className="mt-5">
                    <legend className="text-sm font-semibold text-slate-700 mb-3">
                      Working Hours
                      {isEditMode && (
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          (changing hours may conflict with existing appointments)
                        </span>
                      )}
                    </legend>
                    <div className="space-y-2">
                      {form.working_hours.map((d, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-2.5">
                          <label className="flex w-14 items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={d.enabled}
                              onChange={() => toggleDay(i)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                            {DAYS[d.day_of_week]}
                          </label>
                          {d.enabled && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <input
                                type="time"
                                value={d.start_time}
                                onChange={(e) => updateHour(i, "start_time", e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                              />
                              <span className="text-slate-400">–</span>
                              <input
                                type="time"
                                value={d.end_time}
                                onChange={(e) => updateHour(i, "end_time", e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                              />
                            </div>
                          )}
                          {!d.enabled && <span className="text-xs text-slate-400 italic">Off</span>}
                        </div>
                      ))}
                    </div>
                  </fieldset>

                  {/* Error + conflict list */}
                  <AnimatePresence>
                    {formError && (
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                      >
                        <p className="font-semibold">{formError}</p>

                        {conflicts.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-2">
                              Conflicting appointments:
                            </p>
                            <ul className="space-y-1.5">
                              {conflicts.map((c) => (
                                <li key={c.id} className="rounded-lg bg-red-100 px-3 py-2 text-xs">
                                  <span className="font-semibold">#{c.id}</span>
                                  {" · "}{c.date} at {c.time}
                                  {" · "}<span className="font-medium">{c.patient}</span>
                                  {" – "}{c.service}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-xs text-red-500">
                              Please cancel or reschedule these appointments before changing the schedule.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action buttons */}
                  <div className="mt-7 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:shadow-lg disabled:opacity-60 transition-all"
                    >
                      {saving
                        ? (isAddMode ? "Creating…" : "Saving…")
                        : (isAddMode ? "Create Doctor" : "Save Changes")}
                    </button>
                  </div>
                </>
              )}
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0,  x: "-50%" }}
            exit={{   opacity: 0, y: 20,  x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-50 rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white shadow-xl"
          >
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
