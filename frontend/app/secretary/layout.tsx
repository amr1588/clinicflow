import SecretaryGuard from "@/components/SecretaryGuard";

export const metadata = { title: "Secretary Dashboard — ClinicFlow" };

export default function SecretaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SecretaryGuard>{children}</SecretaryGuard>;
}
