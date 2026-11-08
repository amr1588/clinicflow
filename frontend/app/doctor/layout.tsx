import React from "react";
import DoctorGuard from "@/components/DoctorGuard";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return <DoctorGuard>{children}</DoctorGuard>;
}
