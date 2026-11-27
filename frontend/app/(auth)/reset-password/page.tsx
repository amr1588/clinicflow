"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The password-reset flow now lives entirely in /forgot-password.
 * This page redirects there so that any old links still work.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/forgot-password");
  }, [router]);
  return null;
}
