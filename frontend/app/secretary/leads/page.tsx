"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { LeadStatus } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

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

interface Meta {
  total: number;
  page: number;
  pages: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<LeadStatus, string> = {
  new:                "New",
  contacted:          "Contacted",
  interested:         "Interested",
  appointment_booked: "Booked",
  closed:             "Closed",
  lost:               "Lost",
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new:                "bg-sky-100 text-sky-700",
  contacted:          "bg-violet-100 text-violet-700",
  interested:         "bg-amber-100 text-amber-700",
  appointment_booked: "bg-green-100 text-green-700",
  closed:             "bg-slate-100 text-slate-600",
  lost:               "bg-red-100 text-red-600",
};

const ALL_STATUSES: LeadStatus[] = [
  "new", "contacted", "interested", "appointment_booked", "closed", "lost",
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SecretaryLeadsPage() {
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [meta,    setMeta]    = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Filters
  const [search,       setSearch]       = useState("");
  const [querySearch,  setQuerySearch]  = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "">("");
  const [page,         setPage]         = useState(1);

  // Detail / edit panel
  const [selected,      setSelected]      = useState<Lead | null>(null);
  const [editNotes,     setEditNotes]     = useState("");
  const [editStatus,    setEditStatus]    = useState<LeadStatus>("new");
  const [savingPatch,   setSavingPatch]   = useState(false);
  const [patchError,    setPatchError]    = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // ── Load leads ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (querySearch)  params.set("search", querySearch);
      if (filterStatus) params.set("status", filterStatus);

      const res  = await fetch(`/api/leads?${params}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setLeads(json.data);
      setMeta(json.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [page, querySearch, filterStatus]);

  useEffect(() => { load(); }, [load]);

  // ── Open detail panel ─────────────────────────────────────────────────────

  function openLead(lead: Lead) {
    setSelected(lead);
    setEditNotes(lead.internal_notes ?? "");
    setEditStatus(lead.status);
    setPatchError(null);
  }

  function closePanel() {
    setSelected(null);
  }

  // ── Patch lead ────────────────────────────────────────────────────────────

  async function handlePatch(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSavingPatch(true);
    setPatchError(null);
    try {
      const res  = await fetch(`/api/leads/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status:         editStatus,
          internal_notes: editNotes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update");

      // Update list in-place
      setLeads((prev) =>
        prev.map((l) =>
          l.id === selected.id
            ? { ...l, status: json.data.status, internal_notes: json.data.internal_notes, updated_at: json.data.updated_at }
            : l
        )
      );
      setSelected((s) =>
        s ? { ...s, status: json.data.status, internal_notes: json.data.internal_notes } : s
      );
      showToast("Lead updated");
    } catch (e) {
      setPatchError(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingPatch(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuerySearch(search);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {meta ? `${meta.total} lead${meta.total !== 1 ? "s" : ""} total` : ""}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, or phone…"
              className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as LeadStatus | ""); setPage(1); }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pipeline summary pills */}
      <div className="mb-5 flex flex-wrap gap-2">
        {ALL_STATUSES.map((s) => {
          const count = leads.filter((l) => l.status === s).length;
          return (
            <button
              key={s}
              onClick={() => { setFilterStatus(s === filterStatus ? "" : s); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                s === filterStatus
                  ? STATUS_COLORS[s] + " ring-2 ring-offset-1 ring-current"
                  : STATUS_COLORS[s] + " opacity-70 hover:opacity-100"
              }`}
            >
              {STATUS_LABELS[s]} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && leads.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-16 text-center">
          <p className="text-sm text-slate-500">No leads found.</p>
        </div>
      )}

      {/* Leads table */}
      {!loading && leads.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      selected?.id === l.id ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {l.first_name} {l.last_name}
                      </p>
                      {l.appointment_id && (
                        <span className="text-xs text-green-600 font-medium">
                          → Appt #{l.appointment_id}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-600">{l.email}</p>
                      {l.phone && <p className="text-xs text-slate-400">{l.phone}</p>}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-500">{l.source}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[l.status]}`}>
                        {STATUS_LABELS[l.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(l.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openLead(l)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {selected?.id === l.id ? "Editing…" : "Edit"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-sm text-slate-500">Page {meta.page} of {meta.pages}</span>
              <button
                disabled={page >= meta.pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Side panel: lead detail / edit ─────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={closePanel}>
          <div
            className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {selected.first_name} {selected.last_name}
              </h2>
              <button
                onClick={closePanel}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Contact info */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Contact
                </h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-slate-400 w-16 shrink-0">Email</dt>
                    <dd className="text-slate-700 break-all">{selected.email}</dd>
                  </div>
                  {selected.phone && (
                    <div className="flex gap-2">
                      <dt className="text-slate-400 w-16 shrink-0">Phone</dt>
                      <dd className="text-slate-700">{selected.phone}</dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="text-slate-400 w-16 shrink-0">Source</dt>
                    <dd className="text-slate-700 capitalize">{selected.source}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-slate-400 w-16 shrink-0">Received</dt>
                    <dd className="text-slate-700">{fmtDate(selected.created_at)}</dd>
                  </div>
                  {selected.appointment_id && (
                    <div className="flex gap-2">
                      <dt className="text-slate-400 w-16 shrink-0">Appt</dt>
                      <dd className="text-green-600 font-medium">#{selected.appointment_id}</dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Original message */}
              {selected.message && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                    Message
                  </h3>
                  <p className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selected.message}
                  </p>
                </section>
              )}

              {/* Edit form */}
              <form onSubmit={handlePatch} className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Update Lead
                </h3>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Pipeline Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as LeadStatus)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>

                {/* Internal notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Internal Notes
                    <span className="ml-1 text-xs font-normal text-slate-400">(secretary only)</span>
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={5}
                    maxLength={5000}
                    placeholder="Follow-up notes, call history, next steps…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {patchError && (
                  <p className="text-sm text-red-600">{patchError}</p>
                )}

                <button
                  type="submit"
                  disabled={savingPatch}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {savingPatch ? "Saving…" : "Save Changes"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          ✓ {toast}
        </div>
      )}
    </main>
  );
}

