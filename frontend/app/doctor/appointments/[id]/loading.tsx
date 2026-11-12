export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/10 flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Loading consultation notes...
        </p>
      </div>
    </div>
  );
}
