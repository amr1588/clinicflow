/**
 * ClinicFlow - Global TypeScript Definitions
 * Types match the database schema and API responses exactly.
 */

// ---------------------------------------------------------------------------
// Enums (match MySQL ENUM values — always lowercase)
// ---------------------------------------------------------------------------
export type UserRole = 'patient' | 'doctor' | 'secretary';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'appointment_booked'
  | 'closed'
  | 'lost';

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------
export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Service (as returned by the API)
// ---------------------------------------------------------------------------
export interface Service {
  id: number;
  name: string;
  description?: string;
  price: string;           // DECIMAL comes as string from MySQL
  duration_minutes: number;
  is_active?: number;
}

// ---------------------------------------------------------------------------
// Working Hours
// ---------------------------------------------------------------------------
export interface WorkingHours {
  day_of_week: number;     // 0=Sun, 1=Mon, ... 6=Sat
  start_time: string;      // "09:00:00"
  end_time: string;        // "13:00:00"
}

// ---------------------------------------------------------------------------
// Doctor (as returned by GET /doctors and GET /doctors/:id)
// ---------------------------------------------------------------------------
export interface Doctor {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  specialty: string;
  bio: string | null;
  consultation_fee: string;      // DECIMAL comes as string
  consultation_duration: number;
  photo_url: string | null;
  services: Service[];
  working_hours?: WorkingHours[];  // Only on detail endpoint
}

// ---------------------------------------------------------------------------
// API Response wrapper
// ---------------------------------------------------------------------------
export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
}
