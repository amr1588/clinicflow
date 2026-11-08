<?php
declare(strict_types=1);

/**
 * Consultations Endpoints: Doctor's private clinical notes
 * Strict authorization: DOCTOR role only, and only for their own appointments.
 *
 *   GET  /consultations?appointment_id=X           notes for one appointment
 *   GET  /consultations/history?appointment_id=X   this doctor's previous notes
 *                                                  for the SAME patient
 *   POST /consultations                            create or update (upsert)
 *
 * @var PDO $pdo
 * @var string|null $id
 */

$method = $_SERVER['REQUEST_METHOD'];

// ---------------------------------------------------------------------------
// Auth: doctor only
// ---------------------------------------------------------------------------

if (empty($_SESSION['user_id'])) {
    error_response('Please log in', 401);
}

if (($_SESSION['role'] ?? '') !== 'doctor') {
    error_response('Forbidden', 403);
}

$doctorUserId = (int) $_SESSION['user_id'];

// Resolve doctors.id from the session user id
$stmt = $pdo->prepare('SELECT id FROM doctors WHERE user_id = ?');
$stmt->execute([$doctorUserId]);
$doctorRow = $stmt->fetch();

if (!$doctorRow) {
    error_response('Doctor profile not found', 404);
}

$doctorId = (int) $doctorRow['id'];

// ---------------------------------------------------------------------------
// GET /consultations/history?appointment_id=X
//
// Returns the logged-in doctor's PREVIOUS consultation notes for the same
// patient as appointment X (newest first, current visit excluded).
// The patient is found from the appointment, so the client never sends a
// patient id, and a doctor can only look up patients of their own appointments.
// This block must stay ABOVE the plain GET below.
// ---------------------------------------------------------------------------

if ($method === 'GET' && $id === 'history') {
    $apptId = filter_var($_GET['appointment_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$apptId || $apptId <= 0) {
        error_response('appointment_id query param is required', 422);
    }

    // The appointment must be this doctor's. The patient comes from it.
    $stmt = $pdo->prepare('SELECT patient_id FROM appointments WHERE id = ? AND doctor_id = ?');
    $stmt->execute([$apptId, $doctorId]);
    $current = $stmt->fetch();

    if (!$current) {
        error_response('Appointment not found or not assigned to you', 404);
    }

    // Only THIS doctor's own notes (c.doctor_id = ?). Remove that condition
    // only if the clinic deliberately lets doctors read each other's notes.
    $stmt = $pdo->prepare('
        SELECT c.id,
               c.diagnosis,
               c.treatment,
               c.prescription,
               c.notes,
               c.created_at,
               a.appointment_date AS date,
               a.appointment_time AS time,
               s.name             AS service_name
        FROM   consultations c
        JOIN   appointments a ON a.id = c.appointment_id
        JOIN   services s     ON s.id = a.service_id
        WHERE  a.patient_id = ?
          AND  c.doctor_id  = ?
          AND  a.id <> ?
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
        LIMIT 20
    ');
    $stmt->execute([(int) $current['patient_id'], $doctorId, $apptId]);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['id']   = (int) $row['id'];
        $row['time'] = substr($row['time'], 0, 5);   // "10:00:00" -> "10:00"
    }
    unset($row);

    json_response(['data' => $rows]);
}

// ---------------------------------------------------------------------------
// GET /consultations?appointment_id=X
// ---------------------------------------------------------------------------

if ($method === 'GET') {
    $apptId = filter_var($_GET['appointment_id'] ?? null, FILTER_VALIDATE_INT);
    if (!$apptId || $apptId <= 0) {
        error_response('appointment_id query param is required', 422);
    }

    // Verify this appointment is assigned to this doctor
    $stmt = $pdo->prepare('SELECT id FROM appointments WHERE id = ? AND doctor_id = ?');
    $stmt->execute([$apptId, $doctorId]);
    if (!$stmt->fetch()) {
        error_response('Appointment not found or not assigned to you', 404);
    }

    $stmt = $pdo->prepare('
        SELECT id, appointment_id, diagnosis, treatment, prescription, notes, created_at, updated_at
        FROM   consultations
        WHERE  appointment_id = ?
    ');
    $stmt->execute([$apptId]);
    $row = $stmt->fetch();

    if (!$row) {
        // No notes written yet: return null so the frontend can show an empty form
        json_response(['data' => null]);
    }

    $row['id']             = (int) $row['id'];
    $row['appointment_id'] = (int) $row['appointment_id'];
    json_response(['data' => $row]);
}

// ---------------------------------------------------------------------------
// POST /consultations: create or update (upsert)
// ---------------------------------------------------------------------------

if ($method === 'POST') {
    $input  = json_decode(file_get_contents('php://input'), true) ?? [];
    $apptId = filter_var($input['appointment_id'] ?? null, FILTER_VALIDATE_INT);

    if (!$apptId || $apptId <= 0) {
        error_response('appointment_id is required', 422);
    }

    // Verify ownership and that the appointment is at a stage where notes make sense
    $stmt = $pdo->prepare('SELECT id, status FROM appointments WHERE id = ? AND doctor_id = ?');
    $stmt->execute([$apptId, $doctorId]);
    $appt = $stmt->fetch();

    if (!$appt) {
        error_response('Appointment not found or not assigned to you', 404);
    }

    $allowed = ['checked_in', 'completed'];
    if (!in_array($appt['status'], $allowed, true)) {
        error_response(
            "Notes can only be added for checked-in or completed appointments (current: {$appt['status']})",
            409
        );
    }

    // Sanitise fields: all optional
    $clean = fn(mixed $v): ?string =>
        (is_string($v) && trim($v) !== '') ? mb_substr(trim($v), 0, 5000) : null;

    $diagnosis    = $clean($input['diagnosis']    ?? null);
    $treatment    = $clean($input['treatment']    ?? null);
    $prescription = $clean($input['prescription'] ?? null);
    $notes        = $clean($input['notes']        ?? null);

    // Upsert: the unique constraint on appointment_id handles the duplicate case
    $stmt = $pdo->prepare("
        INSERT INTO consultations
            (appointment_id, doctor_id, diagnosis, treatment, prescription, notes)
        VALUES
            (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            diagnosis    = VALUES(diagnosis),
            treatment    = VALUES(treatment),
            prescription = VALUES(prescription),
            notes        = VALUES(notes),
            updated_at   = CURRENT_TIMESTAMP
    ");
    $stmt->execute([$apptId, $doctorId, $diagnosis, $treatment, $prescription, $notes]);

    // Return the saved record
    $stmt = $pdo->prepare('
        SELECT id, appointment_id, diagnosis, treatment, prescription, notes, created_at, updated_at
        FROM   consultations
        WHERE  appointment_id = ?
    ');
    $stmt->execute([$apptId]);
    $row = $stmt->fetch();

    $row['id']             = (int) $row['id'];
    $row['appointment_id'] = (int) $row['appointment_id'];

    json_response(['data' => $row]);
}

// ---------------------------------------------------------------------------
// Anything else
// ---------------------------------------------------------------------------
error_response('Method not allowed', 405);