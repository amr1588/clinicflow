import React from 'react';

export default function PublicPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-blue-100 p-8 text-center transition-all hover:shadow-2xl">
        <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-md shadow-blue-500/20">
          CF
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          ClinicFlow Public Page
        </h1>
        <p className="text-slate-600 text-sm mb-6">
          Tailwind CSS is active and working properly!
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Tailwind CSS Loaded Successfully
        </div>
      </div>
    </div>
  );
}