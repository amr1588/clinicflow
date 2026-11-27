"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

type Step = "email" | "otp" | "reset" | "done";

const slideVariants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -18 },
};
const transition = { duration: 0.22 };

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition";

const btnClass =
  "w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60";

function ErrorBox({
  message,
  onStartOver,
}: {
  message: string;
  onStartOver?: () => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <p>{message}</p>
      {onStartOver && (
        <button
          type="button"
          onClick={onStartOver}
          className="mt-2 font-medium underline underline-offset-2 hover:text-red-800"
        >
          Send a new code
        </button>
      )}
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDots({ step }: { step: Step }) {
  const steps: Step[] = ["email", "otp", "reset"];
  const idx = steps.indexOf(step);
  if (idx === -1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i <= idx
              ? "w-6 bg-emerald-500"
              : "w-2 bg-slate-200"
          }`}
        />
      ))}
    </div>
  );
}

// ── OTP 6-box input ───────────────────────────────────────────────────────────
function OtpInput({
  digits,
  onChange,
}: {
  digits: string[];
  onChange: (digits: string[]) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function set(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    onChange(next);
    if (value && index < 5) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        onChange(next);
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? "";
    onChange(next);
    const lastFilled = Math.min(pasted.length, 5);
    refs.current[lastFilled]?.focus();
  }

  return (
    <div className="flex justify-center gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={2}
          value={d}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-slate-200 bg-white text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-redirect after done
  useEffect(() => {
    if (step !== "done") return;
    const t = setTimeout(() => router.push("/login"), 3000);
    return () => clearTimeout(t);
  }, [step, router]);

  function resetToStart() {
    setStep("email");
    setDigits(["", "", "", "", "", ""]);
    setPassword("");
    setConfirm("");
    setError(null);
  }

  // ── Step 1: send code ─────────────────────────────────────────────────────
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    try {
      setLoading(true);
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Could not send the code. Please try again.");
      }

      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: verify OTP with backend then advance ──────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = digits.join("");
    if (code.length < 6) {
      setError("Please enter all 6 digits of the code.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: code,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Invalid or expired code. Please try again.");
      }

      // Code confirmed valid — advance to password step
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: reset password ────────────────────────────────────────────────
  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    const code = digits.join("");

    try {
      setLoading(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: code,
          new_password: password,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Could not reset password. Please try again.");
      }

      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ── Shared card wrapper ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/20 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-xl flex items-center justify-center text-sm font-bold shadow-md shadow-emerald-500/20">
            CF
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">
            ClinicFlow
          </span>
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {/* ── Step 1: Email ───────────────────────────────────────── */}
            {step === "email" && (
              <motion.div
                key="email"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
              >
                <StepDots step={step} />
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Forgot your password?
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Enter your email and we&apos;ll send you a 6-digit verification
                  code.
                </p>

                {error && <ErrorBox message={error} />}

                <form onSubmit={handleSendCode} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      placeholder="you@example.com"
                      className={inputClass}
                    />
                  </div>

                  <button type="submit" disabled={loading} className={btnClass}>
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Sending code…
                      </span>
                    ) : (
                      "Send verification code"
                    )}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-500">
                  Remembered it?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Back to log in
                  </Link>
                </p>
              </motion.div>
            )}

            {/* ── Step 2: OTP ─────────────────────────────────────────── */}
            {step === "otp" && (
              <motion.div
                key="otp"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
              >
                <StepDots step={step} />
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Enter verification code
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-slate-700">{email}</span>.
                  It expires in 10 minutes.
                </p>

                {error && <ErrorBox message={error} onStartOver={resetToStart} />}

                <form onSubmit={handleVerifyOtp} className="mt-6 space-y-6">
                  <OtpInput digits={digits} onChange={setDigits} />

                  <button type="submit" disabled={loading} className={btnClass}>
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Verifying…
                      </span>
                    ) : (
                      "Verify code"
                    )}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-500">
                  Didn&apos;t receive it?{" "}
                  <button
                    type="button"
                    onClick={resetToStart}
                    className="font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Send a new code
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── Step 3: New password ─────────────────────────────────── */}
            {step === "reset" && (
              <motion.div
                key="reset"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
              >
                <StepDots step={step} />
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Set new password
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a strong password for your account.
                </p>

                {error && (
                  <ErrorBox message={error} onStartOver={resetToStart} />
                )}

                <form onSubmit={handleReset} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      New password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      autoFocus
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      At least 8 characters
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Confirm new password
                    </label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      className={inputClass}
                    />
                  </div>

                  <button type="submit" disabled={loading} className={btnClass}>
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Updating…
                      </span>
                    ) : (
                      "Update password"
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Step 4: Done ─────────────────────────────────────────── */}
            {step === "done" && (
              <motion.div
                key="done"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
                className="text-center py-4"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
                  ✓
                </div>
                <h1 className="mt-5 text-2xl font-bold text-slate-900 tracking-tight">
                  Password updated!
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  You can now log in with your new password. Redirecting in a
                  moment…
                </p>
                <Link
                  href="/login"
                  className="mt-5 inline-block rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/20 transition hover:shadow-lg"
                >
                  Go to log in
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
