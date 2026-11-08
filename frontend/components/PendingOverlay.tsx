"use client";

import { useLinkStatus } from "next/link";

// Must be rendered INSIDE a <Link>. Shows a spinner while that link's navigation is pending.
export default function PendingOverlay() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  );
}