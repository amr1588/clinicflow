# ClinicFlow — Business Rules

This document summarizes the roles, permissions, and business rules enforced by the ClinicFlow system. All rules are enforced on the **backend**; the frontend only hides UI elements for convenience.

---

## 1. Roles and Permissions

### Patient (`role = 'patient'`)
- Can view and update **only their own** profile.
- Can book new appointments and view **only their own** appointments.
- Can cancel **only their own** appointments (if status allows).
- **Cannot** view other patients' data, doctor notes, consultation records, secretary notes, leads, or revenue information.

### Secretary (`role = 'secretary'`)
- Full operational access to appointments: confirm, cancel, reschedule, check in, mark as complete, mark as no-show.
- Can view and manage all patients (basic info and appointment history).
- Can manage doctors: add, edit, activate/deactivate, set working hours.
- Can manage services: add, edit, activate/deactivate.
- Can manage leads: view, update status, add internal notes, convert to appointment.
- **No automatic access** to doctor's private consultation notes.

### Doctor (`role = 'doctor'`)
- Can view **only appointments assigned to them**.
- Can view relevant patient info and appointment history for their own patients.
- Can create and update consultation notes (private clinical records).
- **Cannot** manage the clinic (other doctors, services, all patients, leads).

---

## 2. Appointment Rules

### Booking
- A **doctor cannot have two appointments at the same date and time** (enforced by a database `UNIQUE` constraint on `doctor_id + appointment_date + appointment_time`).
- **No bookings in the past.** The system rejects any appointment date/time that has already passed.
- **Only active doctors** (with `is_active = 1`) can be booked.
- The backend **re-validates the selected slot** at confirmation time to prevent race conditions.

### Status Transitions
Appointments follow a strict state machine:

```
Pending ──→ Confirmed ──→ Checked In ──→ Completed
  │             │
  │             └──→ No-show
  │             │
  └──→ Cancelled
  │
Confirmed ──→ Cancelled
```

**Allowed transitions:**
| From        | To          | Who Can Do It             |
|-------------|-------------|---------------------------|
| Pending     | Confirmed   | Secretary                 |
| Pending     | Cancelled   | Secretary, Patient (own)  |
| Confirmed   | Checked In  | Secretary                 |
| Confirmed   | Cancelled   | Secretary, Patient (own)  |
| Confirmed   | No-show     | Secretary                 |
| Checked In  | Completed   | Secretary                 |

**All other transitions are rejected** with a clear error (e.g., `Cancelled → Completed` is not allowed).

### Cancellation
- Patients can cancel their own appointments when status is `Pending` or `Confirmed`.
- Secretaries can cancel any appointment when status is `Pending` or `Confirmed`.
- A cancellation reason can optionally be provided.

### Rescheduling
- Treated as a cancel + re-book. The original appointment is cancelled and a new one is created in the new slot.
- Same validation rules apply (no past dates, slot availability, active doctor).

---

## 3. Appointments vs. Consultations

These are **separate concepts**:

| Concept        | Purpose                                 | Managed By  | Visible To                |
|----------------|-----------------------------------------|-------------|---------------------------|
| **Appointment** | Operational scheduling record           | Secretary   | Patient (own), Secretary, Doctor (assigned) |
| **Consultation** | Private medical/clinical notes         | Doctor      | Doctor (own) only         |

- One consultation per appointment (enforced by a `UNIQUE` constraint).
- Only the **owning doctor** (the doctor assigned to the appointment) can create or view the consultation record.
- Secretaries and patients **never** see consultation data through the API.

---

## 4. Lead Pipeline

Leads represent prospective patients or inquiries. They follow this pipeline:

```
New ──→ Contacted ──→ Interested ──→ Appointment Booked ──→ Closed
  │         │              │                                    
  └─────────┴──────────────┴──→ Lost
```

**Rules:**
- A lead is created when someone submits the **Contact form** (source: `website`) or when a secretary manually creates one.
- Secretaries manage leads: update status, add internal notes, assign to staff.
- A lead can optionally **link to the appointment** it converted into (via `appointment_id`).
- Moving a lead to `Appointment Booked` does **not** automatically create an appointment; the conversion is done explicitly.

---

## 5. Working Hours and Availability

- Each doctor has weekly **recurring working hours** stored in the `doctor_working_hours` table.
- A doctor can have **multiple time blocks per day** (e.g., morning and afternoon with a lunch break).
- Available slots are **generated** from working hours, minus already-booked appointments.
- The slot duration depends on the selected **service's duration**.

---

## 6. Data Integrity

- **No blind `ON DELETE CASCADE`** on medical or business records. Users, doctors, and services linked to appointments cannot be deleted — they must be deactivated instead.
- All foreign keys use `ON DELETE RESTRICT` except where safe (notifications, password resets).
- All timestamps use `DATETIME` with `DEFAULT CURRENT_TIMESTAMP`.
- All monetary values use `DECIMAL(10,2)`.
