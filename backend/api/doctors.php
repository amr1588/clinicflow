<?php

/**
 * Doctors Endpoints
 *
 * Public (no auth required):
 *   GET /doctors        → List all active doctors (with specialty, fee, services)
 *   GET /doctors/:id    → Single active doctor detail (public sees active only)
 *
 * Secretary only:
 *   GET  /doctors/:id/schedule  → Return working hours for any doctor (incl. inactive)
 *   POST /doctors               → Create a doctor (creates user + doctor profile)
 *   PATCH /doctors/:id          → Update doctor profile, toggle active, manage services/hours
 *   PUT   /doctors/:id/schedule → Replace schedule with conflict detection
 *
 * @var PDO         $pdo
 * @var string|null $id
 * @var string|null $subresource  Set by index.php from the 3rd URL segment
 */

declare(strict_types=1);

$method = $_SERVER['REQUEST_METHOD'];

// ---------------------------------------------------------------------------
// Helper: load a full doctor row (joins users). $activeOnly = true for public.
// ---------------------------------------------------------------------------
function doctor_load(PDO $pdo, int $doctorId, bool $activeOnly): ?array
{
    $where = $activeOnly ? 'AND d.is_active = 1 AND u.is_active = 1' : '';
    $stmt = $pdo->prepare("
        SELECT
            d.id, d.user_id, d.specialty, d.bio,
            d.consultation_fee, d.consultation_duration,
            d.photo_url, d.is_active,
            u.first_name, u.last_name, u.email, u.phone
        FROM doctors d
        JOIN users u ON u.id = d.user_id
        WHERE d.id = ? $where
    ");
    $stmt->execute([$doctorId]);
    return $stmt->fetch() ?: null;
}

// ---------------------------------------------------------------------------
// Helper: attach services array to a doctor row
// ---------------------------------------------------------------------------
function doctor_attach_services(PDO $pdo, array &$doctor): void
{
    $stmt = $pdo->prepare("
        SELECT s.id, s.name, s.description, s.price, s.duration_minutes
        FROM doctor_services ds
        JOIN services s ON s.id = ds.service_id
        WHERE ds.doctor_id = ? AND s.is_active = 1
        ORDER BY s.name
    ");
    $stmt->execute([$doctor['id']]);
    $services = $stmt->fetchAll();
    foreach ($services as &$svc) {
        $svc['id']               = (int) $svc['id'];
        $svc['duration_minutes'] = (int) $svc['duration_minutes'];
    }
    unset($svc);
    $doctor['services'] = $services;
}

// ---------------------------------------------------------------------------
// Helper: attach working_hours array to a doctor row
// ---------------------------------------------------------------------------
function doctor_attach_hours(PDO $pdo, array &$doctor): void
{
    $stmt = $pdo->prepare("
        SELECT id, day_of_week, start_time, end_time
        FROM doctor_working_hours
        WHERE doctor_id = ?
        ORDER BY day_of_week, start_time
    ");
    $stmt->execute([$doctor['id']]);
    $hours = $stmt->fetchAll();
    foreach ($hours as &$wh) {
        $wh['id']          = (int) $wh['id'];
        $wh['day_of_week'] = (int) $wh['day_of_week'];
    }
    unset($wh);
    $doctor['working_hours'] = $hours;
}

// ---------------------------------------------------------------------------
// Helper: normalize a doctor row's numeric fields
// ---------------------------------------------------------------------------
function doctor_normalize(array &$doctor): void
{
    $doctor['id']                    = (int) $doctor['id'];
    $doctor['consultation_duration'] = (int) $doctor['consultation_duration'];
    $doctor['is_active']             = (int) $doctor['is_active'];
}

// ---------------------------------------------------------------------------
// GET /doctors — List all active doctors (public)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id === null) {
    $stmt = $pdo->query("
        SELECT
            d.id, d.specialty, d.bio,
            d.consultation_fee, d.consultation_duration,
            d.photo_url, d.is_active,
            u.first_name, u.last_name, u.email, u.phone
        FROM doctors d
        JOIN users u ON u.id = d.user_id
        WHERE d.is_active = 1 AND u.is_active = 1
        ORDER BY u.first_name, u.last_name
    ");

    $doctors = $stmt->fetchAll();

    if (!empty($doctors)) {
        $doctorIds    = array_column($doctors, 'id');
        $placeholders = implode(',', array_fill(0, count($doctorIds), '?'));

        $svcStmt = $pdo->prepare("
            SELECT ds.doctor_id, s.id AS service_id, s.name AS service_name,
                   s.price, s.duration_minutes
            FROM doctor_services ds
            JOIN services s ON s.id = ds.service_id
            WHERE ds.doctor_id IN ($placeholders) AND s.is_active = 1
            ORDER BY s.name
        ");
        $svcStmt->execute($doctorIds);
        $allServices = $svcStmt->fetchAll();

        $servicesByDoctor = [];
        foreach ($allServices as $svc) {
            $servicesByDoctor[$svc['doctor_id']][] = [
                'id'               => (int) $svc['service_id'],
                'name'             => $svc['service_name'],
                'price'            => $svc['price'],
                'duration_minutes' => (int) $svc['duration_minutes'],
            ];
        }

        foreach ($doctors as &$doc) {
            doctor_normalize($doc);
            $doc['services'] = $servicesByDoctor[$doc['id']] ?? [];
        }
        unset($doc);
    }

    json_response(['data' => $doctors]);
}

// ---------------------------------------------------------------------------
// GET /doctors/:id/schedule — Secretary only: return working hours
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id !== null && ($subresource ?? null) === 'schedule') {
    if (empty($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'secretary') {
        error_response('Access denied', 403);
    }

    $doctorId = validate_id($id);

    // Verify the doctor exists (active or not)
    $check = $pdo->prepare("SELECT id FROM doctors WHERE id = ?");
    $check->execute([$doctorId]);
    if (!$check->fetch()) {
        error_response('Doctor not found', 404);
    }

    $stmt = $pdo->prepare("
        SELECT id, day_of_week, start_time, end_time
        FROM doctor_working_hours
        WHERE doctor_id = ?
        ORDER BY day_of_week, start_time
    ");
    $stmt->execute([$doctorId]);
    $hours = $stmt->fetchAll();
    foreach ($hours as &$wh) {
        $wh['id']          = (int) $wh['id'];
        $wh['day_of_week'] = (int) $wh['day_of_week'];
    }
    unset($wh);

    json_response(['data' => $hours]);
}

// ---------------------------------------------------------------------------
// GET /doctors/:id — Single doctor detail
//   • Public  → active doctors only
//   • Secretary → any doctor (incl. inactive), via session check
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id !== null) {
    $doctorId  = validate_id($id);
    $isSecretary = !empty($_SESSION['user_id']) && ($_SESSION['role'] ?? '') === 'secretary';

    $doctor = doctor_load($pdo, $doctorId, activeOnly: !$isSecretary);

    if (!$doctor) {
        error_response('Doctor not found', 404);
    }

    doctor_normalize($doctor);
    doctor_attach_services($pdo, $doctor);
    doctor_attach_hours($pdo, $doctor);

    json_response(['data' => $doctor]);
}

// ---------------------------------------------------------------------------
// All endpoints below require a secretary
// ---------------------------------------------------------------------------
if (empty($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'secretary') {
    error_response('Access denied', 403);
}

$input = get_json_body();

// ---------------------------------------------------------------------------
// POST /doctors — Secretary creates a new doctor account + profile
// ---------------------------------------------------------------------------
if ($method === 'POST' && $id === null) {
    // ── Validate required fields ──────────────────────────────────────────
    $first     = sanitize_string($input['first_name'] ?? null);
    $last      = sanitize_string($input['last_name'] ?? null);
    $email     = sanitize_string($input['email'] ?? null);
    $phone     = sanitize_string($input['phone'] ?? null);
    $specialty = sanitize_string($input['specialty'] ?? null);
    $bio       = sanitize_string($input['bio'] ?? null);
    $fee       = filter_var($input['consultation_fee'] ?? null, FILTER_VALIDATE_FLOAT);
    $duration  = filter_var($input['consultation_duration'] ?? 30, FILTER_VALIDATE_INT);
    $password  = $input['password'] ?? '';

    if (!$first || !$last)           error_response('First and last name are required', 422);
    if (!$email)                     error_response('Email is required', 422);
    if (!$specialty)                 error_response('Specialty is required', 422);
    if ($fee === false || $fee < 0)  error_response('Invalid consultation fee', 422);
    if ($duration === false || $duration < 5) error_response('Duration must be at least 5 minutes', 422);
    if (strlen($password) < 8)       error_response('Password must be at least 8 characters', 422);

    $email = validate_email($email);
    $hash  = password_hash($password, PASSWORD_DEFAULT);

    try {
        $pdo->beginTransaction();

        // 1. Create the user account
        $uStmt = $pdo->prepare("
            INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
            VALUES (?, ?, ?, ?, ?, 'doctor')
        ");
        $uStmt->execute([$first, $last, $email, $phone, $hash]);
        $userId = (int) $pdo->lastInsertId();

        // 2. Create the doctor profile
        $dStmt = $pdo->prepare("
            INSERT INTO doctors (user_id, specialty, bio, consultation_fee, consultation_duration)
            VALUES (?, ?, ?, ?, ?)
        ");
        $dStmt->execute([$userId, $specialty, $bio, $fee, $duration]);
        $doctorId = (int) $pdo->lastInsertId();

        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e->getCode() === '23000') {
            error_response('A user with this email already exists', 409);
        }
        throw $e;
    }

    json_response([
        'data' => [
            'id'         => $doctorId,
            'user_id'    => $userId,
            'first_name' => $first,
            'last_name'  => $last,
            'email'      => $email,
            'specialty'  => $specialty,
        ],
    ], 201);
}

// ---------------------------------------------------------------------------
// PUT /doctors/:id/schedule — Replace weekly schedule with conflict detection
//
// Body: { "working_hours": [ { "day_of_week": 1, "start_time": "09:00", "end_time": "17:00" }, ... ] }
//
// Returns 409 with conflict list if future pending/confirmed appointments
// fall on days or times that the new schedule no longer covers.
// ---------------------------------------------------------------------------
if ($method === 'PUT' && $id !== null && ($subresource ?? null) === 'schedule') {
    $doctorId = validate_id($id);

    // Verify doctor exists
    $check = $pdo->prepare("SELECT id FROM doctors WHERE id = ?");
    $check->execute([$doctorId]);
    if (!$check->fetch()) {
        error_response('Doctor not found', 404);
    }

    // Validate the incoming schedule array
    $newHours = $input['working_hours'] ?? null;
    if (!is_array($newHours)) {
        error_response('working_hours must be an array', 422);
    }

    $validated = [];
    foreach ($newHours as $idx => $wh) {
        $day   = filter_var($wh['day_of_week'] ?? null, FILTER_VALIDATE_INT);
        $start = sanitize_string($wh['start_time'] ?? null);
        $end   = sanitize_string($wh['end_time']   ?? null);

        if ($day === false || $day < 0 || $day > 6) {
            error_response("Row $idx: day_of_week must be 0–6", 422);
        }
        if (!$start || !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $start)) {
            error_response("Row $idx: start_time must be HH:MM", 422);
        }
        if (!$end || !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $end)) {
            error_response("Row $idx: end_time must be HH:MM", 422);
        }
        if ($start >= $end) {
            error_response("Row $idx: end_time must be after start_time", 422);
        }
        $validated[] = ['day_of_week' => $day, 'start_time' => $start, 'end_time' => $end];
    }

    // Build a lookup: day_of_week => [ [start, end], ... ]
    $newByDay = [];
    foreach ($validated as $wh) {
        $newByDay[$wh['day_of_week']][] = [$wh['start_time'], $wh['end_time']];
    }

    // Find future pending/confirmed appointments for this doctor
    $apptStmt = $pdo->prepare("
        SELECT
            a.id, a.appointment_date, a.appointment_time,
            DAYOFWEEK(a.appointment_date) - 1 AS day_of_week,
            u.first_name AS patient_first, u.last_name AS patient_last,
            s.name AS service_name
        FROM appointments a
        JOIN users u ON u.id = a.patient_id
        JOIN services s ON s.id = a.service_id
        WHERE a.doctor_id = ?
          AND a.status IN ('pending', 'confirmed')
          AND a.appointment_date >= CURDATE()
        ORDER BY a.appointment_date, a.appointment_time
    ");
    $apptStmt->execute([$doctorId]);
    $futureAppts = $apptStmt->fetchAll();

    // Check each appointment against the new schedule
    $conflicts = [];
    foreach ($futureAppts as $appt) {
        $day  = (int) $appt['day_of_week'];
        $time = substr($appt['appointment_time'], 0, 5); // "HH:MM"

        // This day is no longer in the schedule at all
        if (!isset($newByDay[$day])) {
            $conflicts[] = $appt;
            continue;
        }

        // Check if the appointment time falls within at least one block on that day
        $covered = false;
        foreach ($newByDay[$day] as [$blockStart, $blockEnd]) {
            $bs = substr($blockStart, 0, 5);
            $be = substr($blockEnd, 0, 5);
            if ($time >= $bs && $time < $be) {
                $covered = true;
                break;
            }
        }

        if (!$covered) {
            $conflicts[] = $appt;
        }
    }

    if (!empty($conflicts)) {
        $conflictList = array_map(fn($a) => [
            'id'      => (int) $a['id'],
            'date'    => $a['appointment_date'],
            'time'    => substr($a['appointment_time'], 0, 5),
            'patient' => $a['patient_first'] . ' ' . $a['patient_last'],
            'service' => $a['service_name'],
        ], $conflicts);

        error_response(
            'Schedule change conflicts with ' . count($conflicts) . ' existing appointment(s). Resolve them first.',
            409,
            ['conflicts' => $conflictList]
        );
    }

    // No conflicts — replace the schedule
    try {
        $pdo->beginTransaction();

        $pdo->prepare("DELETE FROM doctor_working_hours WHERE doctor_id = ?")
            ->execute([$doctorId]);

        $insStmt = $pdo->prepare("
            INSERT INTO doctor_working_hours (doctor_id, day_of_week, start_time, end_time)
            VALUES (?, ?, ?, ?)
        ");
        foreach ($validated as $wh) {
            $insStmt->execute([$doctorId, $wh['day_of_week'], $wh['start_time'], $wh['end_time']]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    json_response(['data' => ['id' => $doctorId, 'schedule_updated' => true]]);
}

// ---------------------------------------------------------------------------
// PATCH /doctors/:id — Secretary updates doctor info, services, or hours
//
// Body (all fields optional — send only what changed):
//   first_name, last_name, phone, specialty, bio,
//   consultation_fee, consultation_duration, photo_url,
//   is_active (0|1), service_ids (int[]), working_hours (array)
// ---------------------------------------------------------------------------
if (($method === 'PATCH' || $method === 'PUT') && $id !== null && ($subresource ?? null) === null) {
    $doctorId = validate_id($id);

    // Load the doctor + its user_id
    $stmt = $pdo->prepare("
        SELECT d.id, d.user_id, d.is_active
        FROM doctors d
        JOIN users u ON u.id = d.user_id
        WHERE d.id = ?
    ");
    $stmt->execute([$doctorId]);
    $doctor = $stmt->fetch();

    if (!$doctor) {
        error_response('Doctor not found', 404);
    }

    $pdo->beginTransaction();

    try {
        // ── Profile fields ────────────────────────────────────────────────
        $userSets    = [];
        $userParams  = [];
        $doctorSets  = [];
        $doctorParams = [];

        if (isset($input['first_name'])) {
            $val = sanitize_string($input['first_name']);
            if (!$val) error_response('first_name cannot be empty', 422);
            $userSets[]   = 'first_name = ?';
            $userParams[] = $val;
        }
        if (isset($input['last_name'])) {
            $val = sanitize_string($input['last_name']);
            if (!$val) error_response('last_name cannot be empty', 422);
            $userSets[]   = 'last_name = ?';
            $userParams[] = $val;
        }
        if (array_key_exists('phone', $input)) {
            $userSets[]   = 'phone = ?';
            $userParams[] = sanitize_string($input['phone']);
        }
        if (isset($input['specialty'])) {
            $val = sanitize_string($input['specialty']);
            if (!$val) error_response('specialty cannot be empty', 422);
            $doctorSets[]   = 'specialty = ?';
            $doctorParams[] = $val;
        }
        if (array_key_exists('bio', $input)) {
            $doctorSets[]   = 'bio = ?';
            $doctorParams[] = sanitize_string($input['bio']);
        }
        if (isset($input['consultation_fee'])) {
            $fee = filter_var($input['consultation_fee'], FILTER_VALIDATE_FLOAT);
            if ($fee === false || $fee < 0) error_response('Invalid consultation fee', 422);
            $doctorSets[]   = 'consultation_fee = ?';
            $doctorParams[] = $fee;
        }
        if (isset($input['consultation_duration'])) {
            $dur = filter_var($input['consultation_duration'], FILTER_VALIDATE_INT);
            if ($dur === false || $dur < 5) error_response('Duration must be at least 5 minutes', 422);
            $doctorSets[]   = 'consultation_duration = ?';
            $doctorParams[] = $dur;
        }
        if (array_key_exists('photo_url', $input)) {
            $doctorSets[]   = 'photo_url = ?';
            $doctorParams[] = sanitize_string($input['photo_url']);
        }
        // is_active toggle
        if (isset($input['is_active'])) {
            $active         = $input['is_active'] ? 1 : 0;
            $doctorSets[]   = 'is_active = ?';
            $doctorParams[] = $active;
            $userSets[]     = 'is_active = ?';
            $userParams[]   = $active;
        }

        if (!empty($userSets)) {
            $userParams[] = (int) $doctor['user_id'];
            $pdo->prepare("UPDATE users SET " . implode(', ', $userSets) . " WHERE id = ?")
                ->execute($userParams);
        }
        if (!empty($doctorSets)) {
            $doctorParams[] = $doctorId;
            $pdo->prepare("UPDATE doctors SET " . implode(', ', $doctorSets) . " WHERE id = ?")
                ->execute($doctorParams);
        }

        // ── Services: full replacement ────────────────────────────────────
        if (isset($input['service_ids']) && is_array($input['service_ids'])) {
            $pdo->prepare("DELETE FROM doctor_services WHERE doctor_id = ?")
                ->execute([$doctorId]);

            foreach ($input['service_ids'] as $svcId) {
                $svcId = filter_var($svcId, FILTER_VALIDATE_INT);
                if ($svcId && $svcId > 0) {
                    $pdo->prepare("
                        INSERT IGNORE INTO doctor_services (doctor_id, service_id) VALUES (?, ?)
                    ")->execute([$doctorId, $svcId]);
                }
            }
        }

        // ── Working hours: full replacement (no conflict check here — use PUT /schedule for that)
        if (isset($input['working_hours']) && is_array($input['working_hours'])) {
            $pdo->prepare("DELETE FROM doctor_working_hours WHERE doctor_id = ?")
                ->execute([$doctorId]);

            $insStmt = $pdo->prepare("
                INSERT INTO doctor_working_hours (doctor_id, day_of_week, start_time, end_time)
                VALUES (?, ?, ?, ?)
            ");
            foreach ($input['working_hours'] as $wh) {
                $day   = filter_var($wh['day_of_week'] ?? null, FILTER_VALIDATE_INT);
                $start = preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $wh['start_time'] ?? '') ? $wh['start_time'] : null;
                $end   = preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $wh['end_time']   ?? '') ? $wh['end_time']   : null;

                if ($day === false || $day < 0 || $day > 6 || !$start || !$end || $start >= $end) {
                    continue; // skip invalid rows
                }
                $insStmt->execute([$doctorId, $day, $start, $end]);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    json_response(['data' => ['id' => $doctorId, 'updated' => true]]);
}

error_response('Not found', 404);

// ---------------------------------------------------------------------------
// GET /doctors — List all active doctors (public)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id === null) {
    $stmt = $pdo->query("
        SELECT
            d.id,
            d.specialty,
            d.bio,
            d.consultation_fee,
            d.consultation_duration,
            d.photo_url,
            d.is_active,
            u.first_name,
            u.last_name,
            u.email,
            u.phone
        FROM doctors d
        JOIN users u ON u.id = d.user_id
        WHERE d.is_active = 1
          AND u.is_active = 1
        ORDER BY u.first_name, u.last_name
    ");

    $doctors = $stmt->fetchAll();

    if (!empty($doctors)) {
        $doctorIds    = array_column($doctors, 'id');
        $placeholders = implode(',', array_fill(0, count($doctorIds), '?'));

        $svcStmt = $pdo->prepare("
            SELECT
                ds.doctor_id,
                s.id   AS service_id,
                s.name AS service_name,
                s.price,
                s.duration_minutes
            FROM doctor_services ds
            JOIN services s ON s.id = ds.service_id
            WHERE ds.doctor_id IN ($placeholders)
              AND s.is_active = 1
            ORDER BY s.name
        ");
        $svcStmt->execute($doctorIds);
        $allServices = $svcStmt->fetchAll();

        $servicesByDoctor = [];
        foreach ($allServices as $svc) {
            $servicesByDoctor[$svc['doctor_id']][] = [
                'id'               => (int) $svc['service_id'],
                'name'             => $svc['service_name'],
                'price'            => $svc['price'],
                'duration_minutes' => (int) $svc['duration_minutes'],
            ];
        }

        foreach ($doctors as &$doc) {
            $doc['id']                    = (int) $doc['id'];
            $doc['consultation_duration'] = (int) $doc['consultation_duration'];
            $doc['is_active']             = (int) $doc['is_active'];
            $doc['services']              = $servicesByDoctor[$doc['id']] ?? [];
        }
        unset($doc);
    }

    json_response(['data' => $doctors]);
}

// ---------------------------------------------------------------------------
// GET /doctors/:id — Single active doctor with full details (public)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id !== null) {
    $doctorId = validate_id($id);

    $stmt = $pdo->prepare("
        SELECT
            d.id,
            d.specialty,
            d.bio,
            d.consultation_fee,
            d.consultation_duration,
            d.photo_url,
            d.is_active,
            u.first_name,
            u.last_name,
            u.email,
            u.phone
        FROM doctors d
        JOIN users u ON u.id = d.user_id
        WHERE d.id = ?
          AND d.is_active = 1
          AND u.is_active = 1
    ");
    $stmt->execute([$doctorId]);
    $doctor = $stmt->fetch();

    if (!$doctor) {
        error_response('Doctor not found', 404);
    }

    $doctor['id']                    = (int) $doctor['id'];
    $doctor['consultation_duration'] = (int) $doctor['consultation_duration'];
    $doctor['is_active']             = (int) $doctor['is_active'];

    // Services
    $svcStmt = $pdo->prepare("
        SELECT s.id, s.name, s.description, s.price, s.duration_minutes
        FROM doctor_services ds
        JOIN services s ON s.id = ds.service_id
        WHERE ds.doctor_id = ?
          AND s.is_active = 1
        ORDER BY s.name
    ");
    $svcStmt->execute([$doctorId]);
    $services = $svcStmt->fetchAll();

    foreach ($services as &$svc) {
        $svc['id']               = (int) $svc['id'];
        $svc['duration_minutes'] = (int) $svc['duration_minutes'];
    }
    unset($svc);
    $doctor['services'] = $services;

    // Working hours
    $whStmt = $pdo->prepare("
        SELECT id, day_of_week, start_time, end_time
        FROM doctor_working_hours
        WHERE doctor_id = ?
        ORDER BY day_of_week, start_time
    ");
    $whStmt->execute([$doctorId]);
    $workingHours = $whStmt->fetchAll();

    foreach ($workingHours as &$wh) {
        $wh['id']          = (int) $wh['id'];
        $wh['day_of_week'] = (int) $wh['day_of_week'];
    }
    unset($wh);
    $doctor['working_hours'] = $workingHours;

    json_response(['data' => $doctor]);
}

// ---------------------------------------------------------------------------
// All endpoints below require a secretary
// ---------------------------------------------------------------------------
if (empty($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'secretary') {
    error_response('Access denied', 403);
}

$input = get_json_body();

// ---------------------------------------------------------------------------
// POST /doctors — Secretary creates a new doctor account + profile
// ---------------------------------------------------------------------------
if ($method === 'POST' && $id === null) {
    // ── Validate required fields ──────────────────────────────────────────
    $first     = sanitize_string($input['first_name'] ?? null);
    $last      = sanitize_string($input['last_name'] ?? null);
    $email     = sanitize_string($input['email'] ?? null);
    $phone     = sanitize_string($input['phone'] ?? null);
    $specialty = sanitize_string($input['specialty'] ?? null);
    $bio       = sanitize_string($input['bio'] ?? null);
    $fee       = filter_var($input['consultation_fee'] ?? null, FILTER_VALIDATE_FLOAT);
    $duration  = filter_var($input['consultation_duration'] ?? 30, FILTER_VALIDATE_INT);
    $password  = $input['password'] ?? '';

    if (!$first || !$last)           error_response('First and last name are required', 422);
    if (!$email)                     error_response('Email is required', 422);
    if (!$specialty)                 error_response('Specialty is required', 422);
    if ($fee === false || $fee < 0)  error_response('Invalid consultation fee', 422);
    if ($duration === false || $duration < 5) error_response('Duration must be at least 5 minutes', 422);
    if (strlen($password) < 8)       error_response('Password must be at least 8 characters', 422);

    $email = validate_email($email);
    $hash  = password_hash($password, PASSWORD_DEFAULT);

    try {
        $pdo->beginTransaction();

        // 1. Create the user account
        $uStmt = $pdo->prepare("
            INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
            VALUES (?, ?, ?, ?, ?, 'doctor')
        ");
        $uStmt->execute([$first, $last, $email, $phone, $hash]);
        $userId = (int) $pdo->lastInsertId();

        // 2. Create the doctor profile
        $dStmt = $pdo->prepare("
            INSERT INTO doctors (user_id, specialty, bio, consultation_fee, consultation_duration)
            VALUES (?, ?, ?, ?, ?)
        ");
        $dStmt->execute([$userId, $specialty, $bio, $fee, $duration]);
        $doctorId = (int) $pdo->lastInsertId();

        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e->getCode() === '23000') {
            error_response('A user with this email already exists', 409);
        }
        throw $e;
    }

    json_response([
        'data' => [
            'id'        => $doctorId,
            'user_id'   => $userId,
            'first_name' => $first,
            'last_name'  => $last,
            'email'      => $email,
            'specialty'  => $specialty,
        ],
    ], 201);
}

// ---------------------------------------------------------------------------
// PATCH /doctors/:id — Secretary updates doctor info, services, or hours
//
// The body can contain any combination of these optional keys:
//   profile fields: first_name, last_name, phone, specialty, bio,
//                   consultation_fee, consultation_duration
//   toggle:         is_active (0 or 1)
//   services:       service_ids (array of int) — full replacement
//   hours:          working_hours (array of {day_of_week, start_time, end_time}) — full replacement
// ---------------------------------------------------------------------------
if ($method === 'PATCH' && $id !== null) {
    $doctorId = validate_id($id);

    // Load the doctor + its user_id
    $stmt = $pdo->prepare("
        SELECT d.id, d.user_id, d.is_active
        FROM doctors d
        JOIN users u ON u.id = d.user_id
        WHERE d.id = ?
    ");
    $stmt->execute([$doctorId]);
    $doctor = $stmt->fetch();

    if (!$doctor) {
        error_response('Doctor not found', 404);
    }

    $pdo->beginTransaction();

    try {
        // ── Profile fields (update users + doctors tables) ────────────────
        $profileFields = ['first_name', 'last_name', 'phone', 'specialty', 'bio',
                          'consultation_fee', 'consultation_duration', 'photo_url'];

        $userSets    = [];
        $userParams  = [];
        $doctorSets  = [];
        $doctorParams = [];

        if (isset($input['first_name'])) {
            $val = sanitize_string($input['first_name']);
            if (!$val) error_response('first_name cannot be empty', 422);
            $userSets[]   = 'first_name = ?';
            $userParams[] = $val;
        }
        if (isset($input['last_name'])) {
            $val = sanitize_string($input['last_name']);
            if (!$val) error_response('last_name cannot be empty', 422);
            $userSets[]   = 'last_name = ?';
            $userParams[] = $val;
        }
        if (array_key_exists('phone', $input)) {
            $userSets[]   = 'phone = ?';
            $userParams[] = sanitize_string($input['phone']);
        }
        if (isset($input['specialty'])) {
            $val = sanitize_string($input['specialty']);
            if (!$val) error_response('specialty cannot be empty', 422);
            $doctorSets[]   = 'specialty = ?';
            $doctorParams[] = $val;
        }
        if (array_key_exists('bio', $input)) {
            $doctorSets[]   = 'bio = ?';
            $doctorParams[] = sanitize_string($input['bio']);
        }
        if (isset($input['consultation_fee'])) {
            $fee = filter_var($input['consultation_fee'], FILTER_VALIDATE_FLOAT);
            if ($fee === false || $fee < 0) error_response('Invalid consultation fee', 422);
            $doctorSets[]   = 'consultation_fee = ?';
            $doctorParams[] = $fee;
        }
        if (isset($input['consultation_duration'])) {
            $dur = filter_var($input['consultation_duration'], FILTER_VALIDATE_INT);
            if ($dur === false || $dur < 5) error_response('Duration must be at least 5 minutes', 422);
            $doctorSets[]   = 'consultation_duration = ?';
            $doctorParams[] = $dur;
        }
        if (array_key_exists('photo_url', $input)) {
            $doctorSets[]   = 'photo_url = ?';
            $doctorParams[] = sanitize_string($input['photo_url']);
        }
        // is_active toggle
        if (isset($input['is_active'])) {
            $active = $input['is_active'] ? 1 : 0;
            $doctorSets[]   = 'is_active = ?';
            $doctorParams[] = $active;
            // Also toggle the user account
            $userSets[]   = 'is_active = ?';
            $userParams[] = $active;
        }

        if (!empty($userSets)) {
            $userParams[] = (int) $doctor['user_id'];
            $pdo->prepare("UPDATE users SET " . implode(', ', $userSets) . " WHERE id = ?")
                ->execute($userParams);
        }
        if (!empty($doctorSets)) {
            $doctorParams[] = $doctorId;
            $pdo->prepare("UPDATE doctors SET " . implode(', ', $doctorSets) . " WHERE id = ?")
                ->execute($doctorParams);
        }

        // ── Services: full replacement ────────────────────────────────────
        if (isset($input['service_ids']) && is_array($input['service_ids'])) {
            $pdo->prepare("DELETE FROM doctor_services WHERE doctor_id = ?")
                ->execute([$doctorId]);

            foreach ($input['service_ids'] as $svcId) {
                $svcId = filter_var($svcId, FILTER_VALIDATE_INT);
                if ($svcId && $svcId > 0) {
                    $pdo->prepare("
                        INSERT IGNORE INTO doctor_services (doctor_id, service_id) VALUES (?, ?)
                    ")->execute([$doctorId, $svcId]);
                }
            }
        }

        // ── Working hours: full replacement ───────────────────────────────
        if (isset($input['working_hours']) && is_array($input['working_hours'])) {
            $pdo->prepare("DELETE FROM doctor_working_hours WHERE doctor_id = ?")
                ->execute([$doctorId]);

            $insStmt = $pdo->prepare("
                INSERT INTO doctor_working_hours (doctor_id, day_of_week, start_time, end_time)
                VALUES (?, ?, ?, ?)
            ");
            foreach ($input['working_hours'] as $wh) {
                $day   = filter_var($wh['day_of_week'] ?? null, FILTER_VALIDATE_INT);
                $start = preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $wh['start_time'] ?? '') ? $wh['start_time'] : null;
                $end   = preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $wh['end_time'] ?? '')   ? $wh['end_time']   : null;

                if ($day === false || $day < 0 || $day > 6 || !$start || !$end) {
                    continue; // skip invalid rows silently
                }
                $insStmt->execute([$doctorId, $day, $start, $end]);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    json_response(['data' => ['id' => $doctorId, 'updated' => true]]);
}

error_response('Not found', 404);
