-- ============================================================================
-- ClinicFlow Seed Data
-- Phase 1: Demo users, doctors, services, working hours
-- ============================================================================
-- Run AFTER schema.sql. All demo accounts use password: password123
-- ============================================================================

USE `clinicflow`;

-- ============================================================================
-- USERS
-- Demo accounts: 1 secretary, 2 doctors, 2 patients
-- All passwords: password123 (bcrypt hash)
-- ============================================================================
INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `phone`, `password_hash`, `role`) VALUES
  -- Secretary
  (1, 'Sarah',   'Admin',    'secretary@clinicflow.local', '+1-555-0100',
   '$2y$10$FaIgRuHDu6MIM.gHZ2afYeAwD06DgKaflhPLX56p1HTtfC.vbZVKW', 'secretary'),
  -- Doctors (user accounts)
  (2, 'Ahmed',   'Hassan',   'dr.ahmed@clinicflow.local',  '+1-555-0201',
   '$2y$10$FaIgRuHDu6MIM.gHZ2afYeAwD06DgKaflhPLX56p1HTtfC.vbZVKW', 'doctor'),
  (3, 'Lina',    'Morales',  'dr.lina@clinicflow.local',   '+1-555-0202',
   '$2y$10$FaIgRuHDu6MIM.gHZ2afYeAwD06DgKaflhPLX56p1HTtfC.vbZVKW', 'doctor'),
  -- Patients
  (4, 'Omar',    'Khalil',   'omar@example.com',           '+1-555-0301',
   '$2y$10$FaIgRuHDu6MIM.gHZ2afYeAwD06DgKaflhPLX56p1HTtfC.vbZVKW', 'patient'),
  (5, 'Emily',   'Chen',     'emily@example.com',          '+1-555-0302',
   '$2y$10$FaIgRuHDu6MIM.gHZ2afYeAwD06DgKaflhPLX56p1HTtfC.vbZVKW', 'patient');

-- ============================================================================
-- DOCTORS (extended profiles)
-- ============================================================================
INSERT INTO `doctors` (`id`, `user_id`, `specialty`, `bio`, `consultation_fee`, `consultation_duration`, `is_active`) VALUES
  (1, 2, 'General Medicine',
   'Dr. Ahmed Hassan is a board-certified general practitioner with over 12 years of experience in family medicine. He is passionate about preventive care and chronic disease management.',
   75.00, 30, 1),
  (2, 3, 'Dermatology',
   'Dr. Lina Morales specializes in medical and cosmetic dermatology. With 8 years of clinical experience, she treats conditions ranging from acne and eczema to skin cancer screening.',
   120.00, 45, 1);

-- ============================================================================
-- SERVICES
-- ============================================================================
INSERT INTO `services` (`id`, `name`, `description`, `price`, `duration_minutes`, `is_active`) VALUES
  (1, 'General Consultation',
   'Comprehensive health assessment including vital signs check, physical examination, and personalized health recommendations.',
   75.00, 30, 1),
  (2, 'Follow-up Visit',
   'Review of previous diagnosis, treatment progress evaluation, and care plan adjustments.',
   50.00, 20, 1),
  (3, 'Skin Examination',
   'Full-body skin check for moles, lesions, and early detection of skin conditions. Includes dermoscopy.',
   120.00, 45, 1),
  (4, 'Acne Treatment',
   'Personalized acne management plan including topical and oral medication options, lifestyle counseling, and follow-up scheduling.',
   100.00, 30, 1),
  (5, 'Annual Physical',
   'Thorough yearly health evaluation including blood pressure, BMI, basic lab work review, and wellness counseling.',
   150.00, 60, 1);

-- ============================================================================
-- DOCTOR_SERVICES (which doctor offers which service)
-- ============================================================================
INSERT INTO `doctor_services` (`doctor_id`, `service_id`) VALUES
  -- Dr. Ahmed (General Medicine): General Consultation, Follow-up, Annual Physical
  (1, 1),
  (1, 2),
  (1, 5),
  -- Dr. Lina (Dermatology): Skin Examination, Acne Treatment, Follow-up
  (2, 3),
  (2, 4),
  (2, 2);

-- ============================================================================
-- DOCTOR_WORKING_HOURS
-- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
-- ============================================================================
INSERT INTO `doctor_working_hours` (`doctor_id`, `day_of_week`, `start_time`, `end_time`) VALUES
  -- Dr. Ahmed: Mon-Fri, 09:00-13:00 and 14:00-17:00 (lunch break 13-14)
  (1, 1, '09:00:00', '13:00:00'),
  (1, 1, '14:00:00', '17:00:00'),
  (1, 2, '09:00:00', '13:00:00'),
  (1, 2, '14:00:00', '17:00:00'),
  (1, 3, '09:00:00', '13:00:00'),
  (1, 3, '14:00:00', '17:00:00'),
  (1, 4, '09:00:00', '13:00:00'),
  (1, 4, '14:00:00', '17:00:00'),
  (1, 5, '09:00:00', '13:00:00'),
  (1, 5, '14:00:00', '17:00:00'),
  -- Dr. Lina: Mon, Wed, Fri 10:00-14:00 and Tue, Thu 13:00-18:00
  (2, 1, '10:00:00', '14:00:00'),
  (2, 3, '10:00:00', '14:00:00'),
  (2, 5, '10:00:00', '14:00:00'),
  (2, 2, '13:00:00', '18:00:00'),
  (2, 4, '13:00:00', '18:00:00');

-- ============================================================================
-- SAMPLE LEAD (to verify the leads table works)
-- ============================================================================
INSERT INTO `leads` (`first_name`, `last_name`, `email`, `phone`, `source`, `message`, `status`) VALUES
  ('James', 'Wilson', 'james.wilson@example.com', '+1-555-0400', 'website',
   'Hi, I would like to book a dermatology consultation. Do you accept walk-ins?', 'new');
