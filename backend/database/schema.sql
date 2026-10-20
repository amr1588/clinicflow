-- ============================================================================
-- ClinicFlow Database Schema
-- Phase 1: Tables, indexes, foreign keys, and constraints
-- ============================================================================
-- Run this file in phpMyAdmin or MySQL CLI to create the database structure.
-- Prerequisites: MySQL 5.7+ or MariaDB 10.3+
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `clinicflow`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `clinicflow`;

-- ============================================================================
-- 1. USERS
-- Stores all system users (patients, doctors, secretaries).
-- Role determines access level. A doctor user links to the doctors table.
-- ============================================================================
CREATE TABLE `users` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `first_name`      VARCHAR(100)    NOT NULL,
  `last_name`       VARCHAR(100)    NOT NULL,
  `email`           VARCHAR(255)    NOT NULL,
  `phone`           VARCHAR(30)     DEFAULT NULL,
  `password_hash`   VARCHAR(255)    NOT NULL,
  `role`            ENUM('patient','doctor','secretary') NOT NULL DEFAULT 'patient',
  `is_active`       TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. DOCTORS
-- Extended profile for users with role='doctor'.
-- Operational info: specialty, bio, consultation fee, photo, active status.
-- A doctor being is_active=0 means they can't be booked but their records remain.
-- ============================================================================
CREATE TABLE `doctors` (
  `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`           INT UNSIGNED    NOT NULL,
  `specialty`         VARCHAR(150)    NOT NULL,
  `bio`               TEXT            DEFAULT NULL,
  `consultation_fee`  DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `consultation_duration` INT UNSIGNED NOT NULL DEFAULT 30 COMMENT 'Default duration in minutes',
  `photo_url`         VARCHAR(500)    DEFAULT NULL,
  `is_active`         TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_doctors_user_id` (`user_id`),
  INDEX `idx_doctors_active` (`is_active`),
  INDEX `idx_doctors_specialty` (`specialty`),
  CONSTRAINT `fk_doctors_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT  -- Never delete a user that is a doctor; deactivate instead
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. SERVICES
-- Medical services offered by the clinic (e.g., General Consultation, X-Ray).
-- Each has a name, description, price, and estimated duration.
-- ============================================================================
CREATE TABLE `services` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(200)    NOT NULL,
  `description`     TEXT            DEFAULT NULL,
  `price`           DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `duration_minutes` INT UNSIGNED   NOT NULL DEFAULT 30,
  `is_active`       TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_services_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. DOCTOR_SERVICES (pivot)
-- Which services each doctor can perform. A doctor may offer many services
-- and a service may be offered by many doctors.
-- ============================================================================
CREATE TABLE `doctor_services` (
  `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `doctor_id`   INT UNSIGNED    NOT NULL,
  `service_id`  INT UNSIGNED    NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_doctor_service` (`doctor_id`, `service_id`),
  CONSTRAINT `fk_ds_doctor`
    FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,  -- If a doctor is removed, their service links go too
  CONSTRAINT `fk_ds_service`
    FOREIGN KEY (`service_id`) REFERENCES `services` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. DOCTOR_WORKING_HOURS
-- Weekly recurring schedule for each doctor.
-- day_of_week: 0=Sunday, 1=Monday, ... 6=Saturday (matches PHP date('w')).
-- A doctor can have multiple rows per day (e.g., morning + afternoon blocks).
-- ============================================================================
CREATE TABLE `doctor_working_hours` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `doctor_id`       INT UNSIGNED    NOT NULL,
  `day_of_week`     TINYINT UNSIGNED NOT NULL COMMENT '0=Sun, 1=Mon, ... 6=Sat',
  `start_time`      TIME            NOT NULL,
  `end_time`        TIME            NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_dwh_doctor_day` (`doctor_id`, `day_of_week`),
  CONSTRAINT `fk_dwh_doctor`
    FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT `chk_dwh_day` CHECK (`day_of_week` BETWEEN 0 AND 6),
  CONSTRAINT `chk_dwh_times` CHECK (`start_time` < `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. APPOINTMENTS
-- The core operational record. Links a patient, doctor, and service.
-- Status follows a strict transition: Pending -> Confirmed -> Checked In -> Completed.
-- Also: Pending/Confirmed -> Cancelled, Confirmed -> No-show.
-- ============================================================================
CREATE TABLE `appointments` (
  `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `patient_id`        INT UNSIGNED    NOT NULL,
  `doctor_id`         INT UNSIGNED    NOT NULL,
  `service_id`        INT UNSIGNED    NOT NULL,
  `appointment_date`  DATE            NOT NULL,
  `appointment_time`  TIME            NOT NULL,
  `duration_minutes`  INT UNSIGNED    NOT NULL DEFAULT 30,
  `status`            ENUM('pending','confirmed','checked_in','completed','cancelled','no_show')
                      NOT NULL DEFAULT 'pending',
  `cancellation_reason` TEXT          DEFAULT NULL,
  `notes`             TEXT            DEFAULT NULL COMMENT 'Secretary operational notes',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),

  -- Prevent double-booking: same doctor, same date, same time
  UNIQUE KEY `uq_doctor_datetime` (`doctor_id`, `appointment_date`, `appointment_time`),

  INDEX `idx_appt_patient` (`patient_id`),
  INDEX `idx_appt_doctor_date` (`doctor_id`, `appointment_date`),
  INDEX `idx_appt_status` (`status`),
  INDEX `idx_appt_date` (`appointment_date`),

  CONSTRAINT `fk_appt_patient`
    FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,  -- Never delete a patient that has appointments
  CONSTRAINT `fk_appt_doctor`
    FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,  -- Never delete a doctor that has appointments
  CONSTRAINT `fk_appt_service`
    FOREIGN KEY (`service_id`) REFERENCES `services` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT   -- Never delete a service linked to an appointment
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. CONSULTATIONS
-- Doctor's private medical/clinical notes for an appointment.
-- Only the owning doctor should be able to read/write these.
-- Separate from the operational appointment record.
-- ============================================================================
CREATE TABLE `consultations` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `appointment_id`  INT UNSIGNED    NOT NULL,
  `doctor_id`       INT UNSIGNED    NOT NULL,
  `diagnosis`       TEXT            DEFAULT NULL,
  `treatment`       TEXT            DEFAULT NULL,
  `prescription`    TEXT            DEFAULT NULL,
  `notes`           TEXT            DEFAULT NULL COMMENT 'Private clinical notes',
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),

  -- One consultation per appointment
  UNIQUE KEY `uq_consultation_appointment` (`appointment_id`),

  INDEX `idx_consultation_doctor` (`doctor_id`),

  CONSTRAINT `fk_consult_appointment`
    FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_consult_doctor`
    FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. LEADS
-- Inquiries from the contact form or manually entered by the secretary.
-- Pipeline: New -> Contacted -> Interested -> Appointment Booked -> Closed / Lost.
-- Optionally links to the appointment it converted into.
-- ============================================================================
CREATE TABLE `leads` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `first_name`      VARCHAR(100)    NOT NULL,
  `last_name`       VARCHAR(100)    NOT NULL,
  `email`           VARCHAR(255)    NOT NULL,
  `phone`           VARCHAR(30)     DEFAULT NULL,
  `source`          VARCHAR(100)    DEFAULT 'website' COMMENT 'e.g., website, phone, referral',
  `message`         TEXT            DEFAULT NULL COMMENT 'Initial inquiry message',
  `status`          ENUM('new','contacted','interested','appointment_booked','closed','lost')
                    NOT NULL DEFAULT 'new',
  `internal_notes`  TEXT            DEFAULT NULL COMMENT 'Secretary private follow-up notes',
  `appointment_id`  INT UNSIGNED    DEFAULT NULL COMMENT 'If lead converted to an appointment',
  `assigned_to`     INT UNSIGNED    DEFAULT NULL COMMENT 'Secretary or staff handling this lead',
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_leads_status` (`status`),
  INDEX `idx_leads_email` (`email`),
  INDEX `idx_leads_created` (`created_at`),
  CONSTRAINT `fk_leads_appointment`
    FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT `fk_leads_assigned`
    FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. NOTIFICATIONS
-- In-app notifications for any user (appointment reminders, status changes, etc.)
-- ============================================================================
CREATE TABLE `notifications` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`         INT UNSIGNED    NOT NULL,
  `type`            VARCHAR(50)     NOT NULL COMMENT 'e.g., appointment_confirmed, appointment_cancelled',
  `title`           VARCHAR(255)    NOT NULL,
  `message`         TEXT            NOT NULL,
  `reference_type`  VARCHAR(50)     DEFAULT NULL COMMENT 'e.g., appointment, lead',
  `reference_id`    INT UNSIGNED    DEFAULT NULL COMMENT 'ID of the related record',
  `is_read`         TINYINT(1)      NOT NULL DEFAULT 0,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_notif_user_read` (`user_id`, `is_read`),
  INDEX `idx_notif_created` (`created_at`),
  CONSTRAINT `fk_notif_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE  -- If user is deleted, their notifications go too
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. PASSWORD_RESETS
-- OTP-based password reset tokens. Has attempt limits and expiry.
-- ============================================================================
CREATE TABLE `password_resets` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`         INT UNSIGNED    NOT NULL,
  `otp`             VARCHAR(10)     NOT NULL,
  `attempts`        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `max_attempts`    TINYINT UNSIGNED NOT NULL DEFAULT 5,
  `expires_at`      DATETIME        NOT NULL,
  `used_at`         DATETIME        DEFAULT NULL,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_pr_user` (`user_id`),
  INDEX `idx_pr_expires` (`expires_at`),
  CONSTRAINT `fk_pr_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
