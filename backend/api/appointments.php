<?php

declare(strict_types=1);

/**
 * Appointments Endpoints
 *
 *   GET  /appointments/slots?doctor=ID&service=ID&date=YYYY-MM-DD   (public)
 *   POST /appointments                                              (logged-in patient)
 *   @var PDO $pdo
 *   @var string|null $id
 * $pdo and $id are provided by the front controller.
 * For GET /appointments/slots, $id is "slots".
 */

$method = $_SERVER['REQUEST_METHOD'];
require_once __DIR__ . '/../mail.php';

// ---------------------------------------------------------------------------
// Helpers used only by this file
// ---------------------------------------------------------------------------

/** Returns a positive int, or null if the value is not one. */
function appt_positive_int(mixed $value): ?int
{
    $n = filter_var($value, FILTER_VALIDATE_INT);
    return ($n !== false && $n > 0) ? $n : null;
}

/** Parses YYYY-MM-DD, rejects bad, past, and too-far dates. */
function appt_parse_date(mixed $value): DateTimeImmutable
{
    $str  = is_string($value) ? $value : '';
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $str);

    if (!$date || $date->format('Y-m-d') !== $str) {
        error_response('Invalid date. Use YYYY-MM-DD', 422);
    }

    $today = new DateTimeImmutable('today');
    if ($date < $today) {
        error_response('You cannot book an appointment in the past', 422);
    }
    if ($date > $today->modify('+90 days')) {
        error_response('Appointments can be booked up to 90 days ahead', 422);
    }

    return $date;
}

function appt_time_to_minutes(string $time): int
{
    [$h, $m] = array_map('intval', explode(':', $time));
    return $h * 60 + $m;
}

function appt_minutes_to_time(int $minutes): string
{
    return sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
}

/** Loads the service only if this doctor offers it and everything is active. */
function appt_get_service_for_doctor(PDO $pdo, int $doctorId, int $serviceId): array
{
    $stmt = $pdo->prepare("
        SELECT s.id, s.name, s.duration_minutes
        FROM doctors d
        JOIN users u            ON u.id = d.user_id AND u.is_active = 1
        JOIN doctor_services ds ON ds.doctor_id = d.id
        JOIN services s         ON s.id = ds.service_id AND s.is_active = 1
        WHERE d.id = ? AND d.is_active = 1 AND s.id = ?
    ");
    $stmt->execute([$doctorId, $serviceId]);
    $service = $stmt->fetch();

    if (!$service) {
        error_response('This doctor is not available for the selected service', 404);
    }

    $service['duration_minutes'] = (int) $service['duration_minutes'];
    return $service;
}

/**
 * Working hours minus booked appointments (and minus past times if today).
 * Returns times like ["09:00", "09:30", ...].
 */
function appt_get_available_slots(
    PDO $pdo,
    int $doctorId,
    int $duration,
    DateTimeImmutable $date
): array {
    // 1. The doctor's working blocks for that weekday (0 = Sunday, like PHP's "w")
    $stmt = $pdo->prepare("
        SELECT start_time, end_time
        FROM doctor_working_hours
        WHERE doctor_id = ? AND day_of_week = ?
        ORDER BY start_time
    ");
    $stmt->execute([$doctorId, (int) $date->format('w')]);
    $blocks = $stmt->fetchAll();

    // 2. Active appointments that already occupy time that day
    $stmt = $pdo->prepare("
        SELECT appointment_time, duration_minutes
        FROM appointments
        WHERE doctor_id = ?
          AND appointment_date = ?
          AND status NOT IN ('cancelled', 'no_show')
    ");
    $stmt->execute([$doctorId, $date->format('Y-m-d')]);

    $booked = [];
    foreach ($stmt->fetchAll() as $row) {
        $start    = appt_time_to_minutes($row['appointment_time']);
        $booked[] = [$start, $start + (int) $row['duration_minutes']];
    }

    // 3. If the date is today, hide times that already passed
    $now        = new DateTimeImmutable('now');
    $isToday    = $date->format('Y-m-d') === $now->format('Y-m-d');
    $nowMinutes = ((int) $now->format('H')) * 60 + (int) $now->format('i');

    // 4. Walk each block in steps of the service duration
    $slots = [];
    foreach ($blocks as $block) {
        $blockStart = appt_time_to_minutes($block['start_time']);
        $blockEnd   = appt_time_to_minutes($block['end_time']);

        for ($t = $blockStart; $t + $duration <= $blockEnd; $t += $duration) {
            if ($isToday && $t <= $nowMinutes) {
                continue;
            }

            $conflict = false;
            foreach ($booked as [$bookedStart, $bookedEnd]) {
                // Two ranges overlap when each starts before the other ends
                if ($t < $bookedEnd && $t + $duration > $bookedStart) {
                    $conflict = true;
                    break;
                }
            }

            if (!$conflict) {
                $slots[] = appt_minutes_to_time($t);
            }
        }
    }

    return $slots;
}

// ---------------------------------------------------------------------------
// GET /appointments/slots?doctor=1&service=2&date=2026-10-25
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id === 'slots') {
    $doctorId  = appt_positive_int($_GET['doctor'] ?? null);
    $serviceId = appt_positive_int($_GET['service'] ?? null);

    if ($doctorId === null || $serviceId === null) {
        error_response('doctor and service are required', 422);
    }

    $date    = appt_parse_date($_GET['date'] ?? null);
    $service = appt_get_service_for_doctor($pdo, $doctorId, $serviceId);
    $slots   = appt_get_available_slots($pdo, $doctorId, $service['duration_minutes'], $date);

    json_response(['data' => [
        'date'             => $date->format('Y-m-d'),
        'duration_minutes' => $service['duration_minutes'],
        'slots'            => $slots,
    ]]);
}

// ---------------------------------------------------------------------------
// POST /appointments  -> create a Pending appointment
// ---------------------------------------------------------------------------
if ($method === 'POST' && $id === null) {
    // 1. Who is asking?
    if (empty($_SESSION['user_id'])) {
        error_response('Please log in to book an appointment', 401);
    }
    if (($_SESSION['role'] ?? '') !== 'patient') {
        error_response('Only patients can book appointments', 403);
    }

    // 2. Validate input
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    $doctorId  = appt_positive_int($input['doctor_id'] ?? null);
    $serviceId = appt_positive_int($input['service_id'] ?? null);
    $time      = is_string($input['time'] ?? null) ? $input['time'] : '';
    $reason    = trim((string) ($input['reason'] ?? ''));

    if ($doctorId === null || $serviceId === null) {
        error_response('doctor_id and service_id are required', 422);
    }
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time)) {
        error_response('Invalid time. Use HH:MM', 422);
    }
    if (mb_strlen($reason) > 500) {
        error_response('Reason is too long (max 500 characters)', 422);
    }

    $date    = appt_parse_date($input['date'] ?? null);
    $service = appt_get_service_for_doctor($pdo, $doctorId, $serviceId);

    // 3. Final slot check + insert, in one transaction
    try {
        $pdo->beginTransaction();

        // Lock this doctor's row so two bookings for the same doctor
        // are processed one after the other, never at the same moment.
        $pdo->prepare("SELECT id FROM doctors WHERE id = ? FOR UPDATE")->execute([$doctorId]);

        $available = appt_get_available_slots($pdo, $doctorId, $service['duration_minutes'], $date);
        if (!in_array($time, $available, true)) {
            $pdo->rollBack();
            error_response('This time slot is no longer available', 409);
        }

        $stmt = $pdo->prepare("
            INSERT INTO appointments
                (patient_id, doctor_id, service_id, appointment_date,
                 appointment_time, duration_minutes, status, reason)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        ");
        $stmt->execute([
            $_SESSION['user_id'],
            $doctorId,
            $serviceId,
            $date->format('Y-m-d'),
            $time . ':00',
            $service['duration_minutes'],
            $reason !== '' ? $reason : null,
        ]);

        $appointmentId = (int) $pdo->lastInsertId();
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($e->getCode() === '23000') {   // uq_active_slot: someone else got it
            error_response('This time slot is no longer available', 409);
        }
        throw $e;
    }

    try {
        notify_new_appointment($pdo, $appointmentId);
    } catch (Throwable $e) {
        error_log('Appointment email failed: ' . $e->getMessage());
    }

    json_response(['data' => [
        'id'               => $appointmentId,
        'doctor_id'        => $doctorId,
        'service_id'       => $serviceId,
        'date'             => $date->format('Y-m-d'),
        'time'             => $time,
        'duration_minutes' => $service['duration_minutes'],
        'status'           => 'pending',
    ]], 201);
}

// ---------------------------------------------------------------------------
// GET /appointments  -→ patient sees own; secretary sees all (with filters)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id === null) {
    if (empty($_SESSION['user_id'])) {
        error_response('Please log in', 401);
    }

    $role = $_SESSION['role'] ?? '';

    // ── Patient: own appointments only ────────────────────────────────────
    if ($role === 'patient') {
        $stmt = $pdo->prepare("
            SELECT a.id,
                   a.appointment_date AS date,
                   a.appointment_time AS time,
                   a.duration_minutes,
                   a.status,
                   a.reason,
                   a.cancellation_reason,
                   du.first_name AS doctor_first_name,
                   du.last_name  AS doctor_last_name,
                   d.specialty,
                   s.name        AS service_name,
                   s.price
            FROM appointments a
            JOIN doctors d  ON d.id  = a.doctor_id
            JOIN users   du ON du.id = d.user_id
            JOIN services s ON s.id  = a.service_id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        ");
        $stmt->execute([$_SESSION['user_id']]);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id']               = (int) $row['id'];
            $row['duration_minutes'] = (int) $row['duration_minutes'];
            $row['time']             = substr($row['time'], 0, 5);
        }
        unset($row);

        json_response(['data' => $rows]);
    }

    // ── Secretary: all appointments with optional filters ─────────────────
    if ($role === 'secretary') {
        $where  = ['1=1'];
        $params = [];

        // Filter by date
        if (!empty($_GET['date'])) {
            $where[]  = 'a.appointment_date = ?';
            $params[] = $_GET['date'];
        }
        // Filter by doctor
        if (!empty($_GET['doctor_id'])) {
            $where[]  = 'a.doctor_id = ?';
            $params[] = (int) $_GET['doctor_id'];
        }
        // Filter by status
        $validStatuses = ['pending','confirmed','checked_in','completed','cancelled','no_show'];
        if (!empty($_GET['status']) && in_array($_GET['status'], $validStatuses, true)) {
            $where[]  = 'a.status = ?';
            $params[] = $_GET['status'];
        }
        // Default: show today if no date given
        if (empty($_GET['date']) && empty($_GET['status'])) {
            $where[]  = 'a.appointment_date = CURDATE()';
        }

        $whereClause = implode(' AND ', $where);

        $stmt = $pdo->prepare("
            SELECT a.id,
                   a.appointment_date   AS date,
                   a.appointment_time   AS time,
                   a.duration_minutes,
                   a.status,
                   a.notes,
                   a.cancellation_reason,
                   pu.first_name        AS patient_first_name,
                   pu.last_name         AS patient_last_name,
                   pu.email             AS patient_email,
                   pu.phone             AS patient_phone,
                   du.first_name        AS doctor_first_name,
                   du.last_name         AS doctor_last_name,
                   d.specialty,
                   s.name               AS service_name,
                   s.price
            FROM appointments a
            JOIN users   pu ON pu.id = a.patient_id
            JOIN doctors d  ON d.id  = a.doctor_id
            JOIN users   du ON du.id = d.user_id
            JOIN services s ON s.id  = a.service_id
            WHERE {$whereClause}
            ORDER BY a.appointment_date ASC, a.appointment_time ASC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id']               = (int) $row['id'];
            $row['duration_minutes'] = (int) $row['duration_minutes'];
            $row['time']             = substr($row['time'], 0, 5);
        }
        unset($row);

        json_response(['data' => $rows]);
    }

    // ── Doctor: own appointments only ─────────────────────────────────────
    if ($role === 'doctor') {
        // Resolve doctors.id from the session user id
        $stmt = $pdo->prepare('SELECT id FROM doctors WHERE user_id = ?');
        $stmt->execute([(int) $_SESSION['user_id']]);
        $dr = $stmt->fetch();
        if (!$dr) error_response('Doctor profile not found', 404);
        $doctorId = (int) $dr['id'];

        $where  = ['a.doctor_id = ?'];
        $params = [$doctorId];

        // Optional date filter
        if (!empty($_GET['date'])) {
            $where[]  = 'a.appointment_date = ?';
            $params[] = $_GET['date'];
        }

        // Optional status filter
        $validStatuses = ['pending','confirmed','checked_in','completed','cancelled','no_show'];
        if (!empty($_GET['status']) && in_array($_GET['status'], $validStatuses, true)) {
            $where[]  = 'a.status = ?';
            $params[] = $_GET['status'];
        }

        // Default: show today when no date and no status given
        if (empty($_GET['date']) && empty($_GET['status'])) {
            $where[]  = 'a.appointment_date = CURDATE()';
        }

        $whereClause = implode(' AND ', $where);

        $stmt = $pdo->prepare("
            SELECT a.id,
                   a.appointment_date   AS date,
                   a.appointment_time   AS time,
                   a.duration_minutes,
                   a.status,
                   a.cancellation_reason,
                   pu.first_name        AS patient_first_name,
                   pu.last_name         AS patient_last_name,
                   s.name               AS service_name,
                   s.price
            FROM appointments a
            JOIN users   pu ON pu.id = a.patient_id
            JOIN services s ON s.id  = a.service_id
            WHERE {$whereClause}
            ORDER BY a.appointment_date ASC, a.appointment_time ASC
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id']               = (int) $row['id'];
            $row['duration_minutes'] = (int) $row['duration_minutes'];
            $row['time']             = substr($row['time'], 0, 5);
        }
        unset($row);

        json_response(['data' => $rows]);
    }

    error_response('Forbidden', 403);
}

// ---------------------------------------------------------------------------
// GET /appointments/:id  — single appointment detail (doctor, patient, secretary)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id !== null && $id !== 'slots') {
    if (empty($_SESSION['user_id'])) {
        error_response('Please log in', 401);
    }

    $appointmentId = filter_var($id, FILTER_VALIDATE_INT);
    if (!$appointmentId || $appointmentId <= 0) {
        error_response('Invalid appointment id', 400);
    }

    $role = $_SESSION['role'] ?? '';

    // Build a role-specific WHERE clause so each role only sees what they own
    if ($role === 'doctor') {
        // Resolve doctors.id from session user id
        $stmt = $pdo->prepare('SELECT id FROM doctors WHERE user_id = ?');
        $stmt->execute([(int) $_SESSION['user_id']]);
        $dr = $stmt->fetch();
        if (!$dr) error_response('Doctor profile not found', 404);
        $extraWhere = "AND a.doctor_id = {$dr['id']}";
    } elseif ($role === 'secretary') {
        $extraWhere = '';
    } elseif ($role === 'patient') {
        $extraWhere = "AND a.patient_id = {$_SESSION['user_id']}";
    } else {
        error_response('Forbidden', 403);
    }

    $stmt = $pdo->prepare("
        SELECT a.id,
               a.appointment_date   AS date,
               a.appointment_time   AS time,
               a.duration_minutes,
               a.status,
               a.notes,
               a.cancellation_reason,
               pu.first_name        AS patient_first_name,
               pu.last_name         AS patient_last_name,
               pu.email             AS patient_email,
               pu.phone             AS patient_phone,
               du.first_name        AS doctor_first_name,
               du.last_name         AS doctor_last_name,
               d.specialty,
               s.name               AS service_name,
               s.price
        FROM appointments a
        JOIN users   pu ON pu.id = a.patient_id
        JOIN doctors d  ON d.id  = a.doctor_id
        JOIN users   du ON du.id = d.user_id
        JOIN services s ON s.id  = a.service_id
        WHERE a.id = ? {$extraWhere}
    ");
    $stmt->execute([$appointmentId]);
    $row = $stmt->fetch();

    if (!$row) {
        error_response('Appointment not found', 404);
    }

    $row['id']               = (int) $row['id'];
    $row['duration_minutes'] = (int) $row['duration_minutes'];
    $row['time']             = substr($row['time'], 0, 5);

    json_response(['data' => $row]);
}

// ---------------------------------------------------------------------------
// PATCH /appointments/:id
// • Patients: can only "cancel" their own Pending/Confirmed appointments
// • Secretary: can perform all valid transitions per the state machine
// ---------------------------------------------------------------------------
if ($method === 'PATCH' && $id !== null) {
    if (empty($_SESSION['user_id'])) {
        error_response('Please log in', 401);
    }

    $appointmentId = appt_positive_int($id);
    if ($appointmentId === null) {
        error_response('Invalid appointment id', 400);
    }

    $input  = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = trim($input['action'] ?? '');
    $reason = trim((string) ($input['reason'] ?? ''));
    $notes  = trim((string) ($input['notes']  ?? ''));

    $role = $_SESSION['role'] ?? '';

    // ── Patient: cancel own appointment only ──────────────────────────────
    if ($role === 'patient') {
        if ($action !== 'cancel') {
            error_response('Unsupported action', 422);
        }
        if (mb_strlen($reason) > 500) {
            error_response('Reason is too long (max 500 characters)', 422);
        }

        $stmt = $pdo->prepare("
            SELECT status, appointment_date, appointment_time
            FROM appointments
            WHERE id = ? AND patient_id = ?
        ");
        $stmt->execute([$appointmentId, $_SESSION['user_id']]);
        $appt = $stmt->fetch();

        if (!$appt) {
            error_response('Appointment not found', 404);
        }
        if (!in_array($appt['status'], ['pending', 'confirmed'], true)) {
            error_response("A {$appt['status']} appointment cannot be cancelled", 409);
        }
        $startsAt = new DateTimeImmutable($appt['appointment_date'] . ' ' . $appt['appointment_time']);
        if ($startsAt <= new DateTimeImmutable('now')) {
            error_response('This appointment has already started. Please contact the clinic.', 409);
        }

        $stmt = $pdo->prepare("
            UPDATE appointments
            SET status = 'cancelled', cancellation_reason = ?
            WHERE id = ? AND patient_id = ? AND status IN ('pending', 'confirmed')
        ");
        $stmt->execute([$reason !== '' ? $reason : null, $appointmentId, $_SESSION['user_id']]);

        if ($stmt->rowCount() === 0) {
            error_response('This appointment can no longer be cancelled', 409);
        }

        json_response(['data' => ['id' => $appointmentId, 'status' => 'cancelled']]);
    }

    // ── Secretary: state-machine transitions ──────────────────────────────
    if ($role === 'secretary') {
        // Valid secretary actions and which source statuses they require
        $transitions = [
            'confirm'    => ['from' => ['pending'],              'to' => 'confirmed'],
            'check_in'   => ['from' => ['confirmed'],            'to' => 'checked_in'],
            'complete'   => ['from' => ['checked_in'],           'to' => 'completed'],
            'no_show'    => ['from' => ['confirmed'],            'to' => 'no_show'],
            'cancel'     => ['from' => ['pending','confirmed'],  'to' => 'cancelled'],
        ];

        if (!array_key_exists($action, $transitions)) {
            error_response('Invalid action. Use: confirm, check_in, complete, no_show, cancel', 422);
        }

        $stmt = $pdo->prepare("
            SELECT id, status FROM appointments WHERE id = ?
        ");
        $stmt->execute([$appointmentId]);
        $appt = $stmt->fetch();

        if (!$appt) {
            error_response('Appointment not found', 404);
        }

        $transition = $transitions[$action];
        if (!in_array($appt['status'], $transition['from'], true)) {
            $allowed = implode(' or ', $transition['from']);
            error_response(
                "Cannot {$action}: appointment is {$appt['status']} (must be {$allowed})",
                409
            );
        }

        $newStatus = $transition['to'];

        // Update — also allow updating secretary notes at the same time
        $stmt = $pdo->prepare("
            UPDATE appointments
            SET status = ?,
                cancellation_reason = ?,
                notes = COALESCE(NULLIF(?, ''), notes)
            WHERE id = ?
        ");
        $stmt->execute([
            $newStatus,
            ($action === 'cancel' && $reason !== '') ? $reason : null,
            $notes,
            $appointmentId,
        ]);

        json_response(['data' => ['id' => $appointmentId, 'status' => $newStatus]]);
    }

    error_response('Forbidden', 403);
}

// ---------------------------------------------------------------------------
// Anything else
// ---------------------------------------------------------------------------
error_response('Not found', 404);
