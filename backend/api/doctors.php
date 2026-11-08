<?php

/**
 * Doctors Endpoints
 *
 * Public (no auth required):
 *   GET /doctors        → List all active doctors (with specialty, fee, services)
 *   GET /doctors/:id    → Single active doctor detail
 *
 * Secretary only:
 *   POST  /doctors          → Create a doctor (creates user + doctor profile)
 *   PATCH /doctors/:id      → Update doctor profile, toggle active, manage services/hours
 *
 * @var PDO         $pdo
 * @var string|null $id
 */

declare(strict_types=1);

$method = $_SERVER['REQUEST_METHOD'];

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
