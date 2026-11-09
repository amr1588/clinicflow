"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import type { LeadStatus } from "@/types";

interface Lead {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  source: string;
  message: string | null;
  status: LeadStatus;
  internal_notes: string | null;
  appointment_id: number | null;
  created_at: string;
  updated_at: string;
}

interface Meta { total: number; page: number; pages: number; }

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New", contacted: "Contacted", interested: "Interested",
  appointment_booked: "Booked", closed: "Closed", lost: "Lost",
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new:                "bg-sky-100 text-sky-700 ring-sky-200",
  contacted:          "bg-violet-100 text-violet-700 ring-violet-200",
  interested:         "bg-amber-100 text-amber-700 ring-amber-200",
  appointment_booked: "bg-green-100 text-green-700 ring-green-200",
  closed:             "bg-slate-100 text-slate-600 ring-slate-200",
  lost:               "bg-red-100 text-red-600 ring-red-200",
};

const ALL_STATUSES: LeadStatus[] = [
  "new", "contacted", "interested", "appointment_booked", "closed", "lost",
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition";

const textareaCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-none";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

export default function SecretaryLeadsPage() {
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [meta,    setMeta]    = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [search,       setSearch]       = useState("");
  const [querySearch,  setQuerySearch]  = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "">("");
  const [page,         setPage]         = useState(1);

  const [selected,    setSelected]    = useState<Lead | null>(null);
  const [editNotes,   setEditNotes]   = useState("");
  const [editStatus,  setEditStatus]  = useState<LeadStatus>("new");
  const [savingPatch, setSavingPatch] = useState(false);
  const [patchError,  setPatchError]  = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (querySearch)  params.set("search", querySearch);
      if (filterStatus) params.set("status", filterStatus);
      const res  = await fetch(`/api/leads?${params}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setLeads(json.data); setMeta(json.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [page, querySearch, filterStatus]);

  useEffect(() => { load(); }, [load]);

  function openLead(lead: Lead) {
    setSelected(lead); setEditNotes(lead.internal_notes ?? ""); setEditStatus(lead.status); setPatchError(null);
  }

  async function handlePatch(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSavingPatch(true); setPatchError(null);
    try {
      const res  = await fetch(`/api/leads/${selected.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus, internal_notes: editNotes || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update");
      setLeads((prev) =>
        prev.map((l) => l.id === selected.id
          ? { ...l, status: json.data.status, internal_notes: json.data.internal_notes, updated_at: json.data.updated_at }
          : l)
      );
      setSelected((s) => s ? { ...s, status: json.data.status, internal_notes: json.data.internal_notes } : s);
      showToast("Lead updated");
    } catch (e) {
      setPatchError(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingPatch(false);
    }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }
  function handleSearch(e: React.FormEvent) { e.preventDefault(); setPage(1); setQuerySearch(search); }

  // Count per status from current page (approximation)
  const countFor = (s: LeadStatus) => leads.filter((l) => l.status === s).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/15 to-cyan-50/10">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="mt-1 text-slate-500">
            {meta ? `${meta.total} lead${meta.total !== 1 ? "s" : ""} in pipeline` : "Lead pipeline"}
          </p>
        </motion.div>

        {/* Pipeline pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          className="mb-5 flex flex-wrap gap-2"
        >
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s === filterStatus ? "" : s); setPage(1); }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition-all ${STATUS_COLORS[s]} ${
                s === filterStatus ? "shadow-sm scale-105" : "opacity-70 hover:opacity-100"
              }`}
            >
              {STATUS_LABELS[s]}
              {countFor(s) > 0 && (
                <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                  {countFor(s)}
                </span>
              )}
            </button>
          ))}
        </motion.div>

        {/* Search + filter bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm px-5 py-4 shadow-sm"
        >
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
            <input
              type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, or phone…"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm">
              Search
            </button>
          </form>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as LeadStatus | ""); setPage(1); }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
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

        {!loading && leads.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <p className="text-2xl mb-2">📬</p>
            <p className="text-sm text-slate-500">No leads found.</p>
          </motion.div>
        )}

        {/* Leads table */}
        {!loading && leads.length > 0 && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      {["Name", "Contact", "Source", "Status", "Received", ""].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((l, i) => (
                      <motion.tr
                        key={l.id}
                        variants={cardVariants}
                        initial="hidden"
                        animate="show"
                        transition={{ delay: i * 0.02 }}
                        className={`hover:bg-slate-50/60 transition-colors ${selected?.id === l.id ? "bg-blue-50/40" : ""}`}
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">{l.first_name} {l.last_name}</p>
                          {l.appointment_id && (
                            <span className="text-xs font-medium text-green-600">→ Appt #{l.appointment_id}</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-slate-700">{l.email}</p>
                          {l.phone && <p className="text-xs text-slate-400">{l.phone}</p>}
                        </td>
                        <td className="px-5 py-4 capitalize text-slate-500">{l.source}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_COLORS[l.status]}`}>
                            {STATUS_LABELS[l.status]}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-500">{fmtDate(l.created_at)}</td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => openLead(l)}
                            className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-600 transition"
                          >
                            {selected?.id === l.id ? "Editing…" : "Edit →"}
                          </button>
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

      {/* ── Side panel ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setSelected(null)}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Panel header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur-sm px-6 py-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selected.first_name} {selected.last_name}</h2>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 mt-1 ${STATUS_COLORS[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                </div>
                <button onClick={() => setSelected(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition text-sm font-bold">
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Contact info */}
                <section className="rounded-2xl bg-slate-50 p-4 space-y-2 text-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Contact Info</h3>
                  <div className="flex gap-3">
                    <span className="text-slate-400 w-14 shrink-0 font-medium">Email</span>
                    <span className="text-slate-800 break-all">{selected.email}</span>
                  </div>
                  {selected.phone && (
                    <div className="flex gap-3">
                      <span className="text-slate-400 w-14 shrink-0 font-medium">Phone</span>
                      <span className="text-slate-800">{selected.phone}</span>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <span className="text-slate-400 w-14 shrink-0 font-medium">Source</span>
                    <span className="text-slate-800 capitalize">{selected.source}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-slate-400 w-14 shrink-0 font-medium">Received</span>
                    <span className="text-slate-800">{fmtDate(selected.created_at)}</span>
                  </div>
                  {selected.appointment_id && (
                    <div className="flex gap-3">
                      <span className="text-slate-400 w-14 shrink-0 font-medium">Appt</span>
                      <span className="text-green-700 font-semibold">#{selected.appointment_id}</span>
                    </div>
                  )}
                </section>

                {/* Original message */}
                {selected.message && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Message</h3>
                    <p className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {selected.message}
                    </p>
                  </section>
                )}

                {/* Edit form */}
                <form onSubmit={handlePatch} className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Update Lead</h3>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pipeline Status</label>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as LeadStatus)}
                      className={inputCls}>
                      {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Internal Notes
                      <span className="ml-1.5 text-xs font-normal text-slate-400">(secretary only)</span>
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={6}
                      maxLength={5000}
                      placeholder="Follow-up notes, call history, next steps…"
                      className={textareaCls}
                    />
                  </div>

                  <AnimatePresence>
                    {patchError && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {patchError}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button type="submit" disabled={savingPatch}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:shadow-lg disabled:opacity-60 transition-all">
                    {savingPatch ? "Saving…" : "Save Changes"}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
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
