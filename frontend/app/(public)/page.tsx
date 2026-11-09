"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-blue-400/20 via-cyan-300/20 to-teal-300/10 blur-3xl" />

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 lg:pt-24 lg:pb-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="inline-flex items-center gap-2 rounded-full bg-blue-50/80 border border-blue-200/60 px-4 py-1.5 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur-sm mb-8"
        >
          <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
          Modern Healthcare Scheduling Platform
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15]"
        >
          Effortless Clinic Operations. <br />
          <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
            Exceptional Patient Care.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed"
        >
          ClinicFlow connects patients, doctors, and clinic secretaries into one
          seamless ecosystem. Book appointments in seconds, coordinate daily schedules,
          and maintain secure clinical notes.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/book"
            className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            Book an Appointment →
          </Link>
          <Link
            href="/doctors"
            className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm px-7 py-3.5 text-base font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:bg-slate-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Meet Our Doctors
          </Link>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-4xl mx-auto"
        >
          {[
            { label: "Patient Satisfaction", value: "99.4%" },
            { label: "Active Doctors", value: "25+" },
            { label: "Online Booking", value: "24/7" },
            { label: "Wait Time Reduction", value: "40%" },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/80 bg-white/70 p-5 backdrop-blur-sm shadow-sm"
            >
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-600">
                {stat.value}
              </div>
              <div className="mt-1 text-xs font-medium text-slate-500">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Designed for Every Role
          </h2>
          <p className="mt-2 text-slate-500 text-sm sm:text-base">
            Specialized workflows tailored for patients, healthcare providers, and desk managers.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              role: "For Patients",
              title: "Instant Self-Booking",
              desc: "Choose your specialty, select your preferred practitioner, and pick an available slot in real time with instant email confirmation.",
              badge: "bg-blue-100 text-blue-700",
              link: "/book",
              action: "Book visit",
            },
            {
              role: "For Doctors",
              title: "Clinical Day Overview",
              desc: "Clear daily patient queues, duration indicators, and integrated consultation notes with diagnosis, treatment, and prescription tracking.",
              badge: "bg-emerald-100 text-emerald-700",
              link: "/doctor",
              action: "Doctor portal",
            },
            {
              role: "For Secretaries",
              title: "Total Operations Control",
              desc: "Live appointments dashboard with check-in and completion transitions, doctor schedule management, service pricing, and lead pipeline.",
              badge: "bg-cyan-100 text-cyan-700",
              link: "/secretary",
              action: "Front desk",
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider mb-4 ${card.badge}`}
                >
                  {card.role}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {card.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  {card.desc}
                </p>
              </div>
              <Link
                href={card.link}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {card.action} →
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
