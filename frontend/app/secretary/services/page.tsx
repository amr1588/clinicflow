"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import type { Service } from "@/types";

const inputCls =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

export default function SecretaryServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", duration_minutes: "30" });

  const [toggling, setToggling] = useState<number | null>(null);
  const [toast,    setToast]    = useState<string | null>(null);

  async function loadServices() {
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/services", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setServices(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadServices(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError(null);
    try {
      const body = {
        name: form.name,
        description: form.description || undefined,
        price: parseFloat(form.price) || 0,
        duration_minutes: parseInt(form.duration_minutes) || 30,
      };
      const res  = await fetch("/api/services", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setShowForm(false);
      setForm({ name: "", description: "", price: "", duration_minutes: "30" });
      showToast("Service created");
      loadServices();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(svc: Service) {
    setToggling(svc.id);
    try {
      const newActive = svc.is_active ? 0 : 1;
      const res  = await fetch(`/api/services/${svc.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, is_active: newActive } : s));
      showToast(newActive ? "Service activated" : "Service deactivated");
    } catch (e) {
      showToast("Error: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setToggling(null);
    }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/15 to-cyan-50/10">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Services</h1>
            <p className="mt-1 text-slate-500">{services.length} service{services.length !== 1 ? "s" : ""} available</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:shadow-lg transition-all"
          >
            + Add Service
          </motion.button>
        </motion.div>

        {/* Error */}
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

        {!loading && !error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    {["Service", "Description", "Price", "Duration", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {services.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-sm text-slate-400">
                        No services yet — add one to get started.
                      </td>
                    </tr>
                  ) : (
                    services.map((s, i) => (
                      <motion.tr
                        key={s.id}
                        variants={cardVariants}
                        initial="hidden"
                        animate="show"
                        transition={{ delay: i * 0.02 }}
                        className={`hover:bg-slate-50/60 transition-colors ${!s.is_active ? "opacity-50" : ""}`}
                      >
                        <td className="px-5 py-4 font-semibold text-slate-900">{s.name}</td>
                        <td className="max-w-[200px] px-5 py-4 text-slate-500">
                          <span className="line-clamp-2">{s.description ?? <span className="italic text-slate-300">—</span>}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-800">${s.price}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            {s.duration_minutes} min
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            s.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {s.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => toggleActive(s)}
                            disabled={toggling === s.id}
                            className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                              s.is_active
                                ? "border-red-200 text-red-600 hover:bg-red-50"
                                : "border-green-200 text-green-600 hover:bg-green-50"
                            }`}
                          >
                            {toggling === s.id ? "…" : s.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </main>

      {/* Create service modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{   opacity: 0, scale: 0.93, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onSubmit={handleCreate}
              className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
            >
              <h2 className="mb-6 text-xl font-bold text-slate-900">Add New Service</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Service name *</label>
                  <input
                    type="text" required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. General Consultation"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700">Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Short description of the service…"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Price (USD) *</label>
                    <input
                      type="number" min="0" step="0.01" required
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700">Duration (min) *</label>
                    <input
                      type="number" min="5" required
                      value={form.duration_minutes}
                      onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {formError && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                    {formError}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="mt-7 flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:shadow-lg disabled:opacity-60 transition-all">
                  {saving ? "Creating…" : "Create Service"}
                </button>
              </div>
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
