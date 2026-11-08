import type { AppointmentStatus } from "@/types";

const styles: Record<AppointmentStatus, { label: string; className: string }> =
  {
    pending: {
      label: "Pending",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    },
    confirmed: {
      label: "Confirmed",
      className: "bg-blue-50 text-blue-700 border-blue-200",
    },
    checked_in: {
      label: "Checked in",
      className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    completed: {
      label: "Completed",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-slate-100 text-slate-600 border-slate-200",
    },
    no_show: {
      label: "No-show",
      className: "bg-red-50 text-red-700 border-red-200",
    },
  };

export default function StatusBadge({ status }: { status: AppointmentStatus }) {
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}
    >
      {s.label}
    </span>
  );
}
