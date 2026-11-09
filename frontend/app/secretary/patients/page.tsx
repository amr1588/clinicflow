"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";

interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  is_active: number;
  created_at: string;
  appointment_count: number;
}

interface Meta { total: number; page: number; pages: number; }

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

export default function SecretaryPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [meta,     setMeta]     = useState<Meta | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [query,  setQuery]  = useState("");

  async function load(q: string, p: number) {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set("search", q);
      const res  = await fetch(`/api/patients?${params}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setPatients(json.data); setMeta(json.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(query, page); }, [query, page]);

  function handleSearch(e: React.FormEvent) { e.preventDefault(); setPage(1); setQuery(search); }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/15 to-cyan-50/10">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Patients</h1>
            <p className="mt-1 text-slate-500">
              {meta ? `${meta.total} registered patient${meta.total !== 1 ? "s" : ""}` : ""}
            </p>
          </div>

          {/* Search */}
          <motion.form
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            onSubmit={handleSearch} className="flex gap-2"
          >
            <input
              type="search" value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, or phone…"
              className="w-64 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
            <button type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition">
              Search
            </button>
          </motion.form>
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

        {!loading && !error && patients.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <p className="text-2xl mb-2">👤</p>
            <p className="text-sm text-slate-500">No patients found.</p>
          </motion.div>
        )}

        {!loading && patients.length > 0 && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Name", "Email", "Phone", "Appointments", "Joined", "Status"].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patients.map((p, i) => (
                      <motion.tr
                        key={p.id}
                        variants={cardVariants}
                        initial="hidden"
                        animate="show"
                        transition={{ delay: i * 0.02 }}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-5 py-4 font-semibold text-slate-900">{p.first_name} {p.last_name}</td>
                        <td className="px-5 py-4 text-slate-600">{p.email}</td>
                        <td className="px-5 py-4 text-slate-500">{p.phone ?? <span className="italic text-slate-300">—</span>}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                            {p.appointment_count}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            p.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {p.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {meta && meta.pages > 1 && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                  ← Prev
                </button>
                <span className="text-sm text-slate-500">Page {meta.page} of {meta.pages}</span>
                <button disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
