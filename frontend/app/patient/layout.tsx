import PatientGuard from "@/components/PatientGuard";

export const metadata = { title: "My Account — ClinicFlow" };

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PatientGuard>{children}</PatientGuard>;
}
