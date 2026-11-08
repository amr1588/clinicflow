<?php
/**
 * Leads Endpoints
 *
 *   POST /leads                       – Public: submit a contact-form inquiry (no auth)
 *   GET  /leads                       – Secretary: list leads with optional filters
 *   GET  /leads/:id                   – Secretary: single lead detail
 *   PATCH /leads/:id                  – Secretary: update status, internal_notes, assigned_to
 *   POST /leads/:id/convert           – Secretary: convert lead → appointment (via id="<id>/convert")
 *
 * Note: The front controller splits on '/' so /leads/5/convert arrives with:
 *   $id = "5" and the remaining path part is NOT captured by default.
 *   We work around this by checking $id for the pattern "<number>/convert" using
 *   the raw request URI.
 */

declare(strict_types=1);

$method = $_SERVER['REQUEST_METHOD'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

$validStatuses = ['new', 'contacted', 'interested', 'appointment_booked', 'closed', 'lost'];

function leads_positive_int(mixed $value): ?int
{
    $n = filter_var($value, FILTER_VALIDATE_INT);
    return ($n !== false && $n > 0) ? $n : null;
}

// Detect /leads/<id>/convert from the raw URI
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$isConvert  = (bool) preg_match('#/leads/(\d+)/convert$#', $requestUri, $convertMatch);
$convertId  = $isConvert ? (int) $convertMatch[1] : null;

// ---------------------------------------------------------------------------
// POST /leads  – Public inquiry (no auth required)
// ---------------------------------------------------------------------------

if ($method === 'POST' && $id === null && !$isConvert) {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    $firstName = trim((string) ($input['first_name'] ?? ''));
    $lastName  = trim((string) ($input['last_name']  ?? ''));
    $email     = trim((string) ($input['email']      ?? ''));
    $phone     = trim((string) ($input['phone']      ?? ''));
    $message   = trim((string) ($input['message']    ?? ''));
    $source    = trim((string) ($input['source']     ?? 'website'));

    if ($firstName === '' || $lastName === '' || $email === '') {
        error_response('first_name, last_name, and email are required', 422);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_response('Invalid email address', 422);
    }

    $stmt = $pdo->prepare("
        INSERT INTO leads (first_name, last_name, email, phone, source, message, status)
        VALUES (?, ?, ?, ?, ?, ?, 'new')
    ");
    $stmt->execute([
        mb_substr($firstName, 0, 100),
        mb_substr($lastName,  0, 100),
        mb_substr($email,     0, 255),
        $phone   !== '' ? mb_substr($phone,   0, 30)   : null,
        mb_substr($source,    0, 100),
        $message !== '' ? mb_substr($message, 0, 5000) : null,
    ]);

    $newId = (int) $pdo->lastInsertId();
    json_response(['data' => ['id' => $newId, 'status' => 'new']], 201);
}

// ---------------------------------------------------------------------------
// Secretary-only endpoints – require authentication
// ---------------------------------------------------------------------------

if (empty($_SESSION['user_id'])) {
    error_response('Please log in', 401);
}
if (($_SESSION['role'] ?? '') !== 'secretary') {
    error_response('Forbidden', 403);
}

// ---------------------------------------------------------------------------
// POST /leads/:id/convert  – Convert lead to appointment
// ---------------------------------------------------------------------------

if ($method === 'POST' && $isConvert) {
    $leadId = $convertId;
    $input  = json_decode(file_get_contents('php://input'), true) ?? [];

    $doctorId  = leads_positive_int($input['doctor_id']  ?? null);
    $serviceId = leads_positive_int($input['service_id'] ?? null);
    $date      = trim((string) ($input['date']           ?? ''));
    $time      = trim((string) ($input['time']           ?? ''));

    if (!$doctorId || !$serviceId || $date === '' || $time === '') {
        error_response('doctor_id, service_id, date, and time are required', 422);
    }

    // Validate date format
    $dateObj = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$dateObj || $dateObj->format('Y-m-d') !== $date) {
        error_response('Invalid date format. Use YYYY-MM-DD', 422);
    }
    if ($dateObj < new DateTimeImmutable('today')) {
        error_response('Cannot book an appointment in the past', 422);
    }

    // Validate time format
    if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
        error_response('Invalid time format. Use HH:MM', 422);
    }

    // Load lead
    $stmt = $pdo->prepare('SELECT * FROM leads WHERE id = ?');
    $stmt->execute([$leadId]);
    $lead = $stmt->fetch();
    if (!$lead) error_response('Lead not found', 404);

    // Look up or create a patient account for this lead's email
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND role = 'patient'");
    $stmt->execute([$lead['email']]);
    $patient = $stmt->fetch();

    $pdo->beginTransaction();
    try {
        if (!$patient) {
            // Create a placeholder patient account
            $tempPw = password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("
                INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
                VALUES (?, ?, ?, ?, ?, 'patient')
            ");
            $stmt->execute([
                $lead['first_name'],
                $lead['last_name'],
                $lead['email'],
                $lead['phone'],
                $tempPw,
            ]);
            $patientId = (int) $pdo->lastInsertId();
        } else {
            $patientId = (int) $patient['id'];
        }

        // Get service duration
        $stmt = $pdo->prepare('SELECT duration_minutes FROM services WHERE id = ? AND is_active = 1');
        $stmt->execute([$serviceId]);
        $service = $stmt->fetch();
        if (!$service) error_response('Service not found or inactive', 404);

        // Check slot availability (simple overlap check)
        $stmt = $pdo->prepare("
            SELECT id FROM appointments
            WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
        ");
        $stmt->execute([$doctorId, $date, $time]);
        if ($stmt->fetch()) {
            error_response('This time slot is already booked for that doctor', 409);
        }

        // Create appointment
        $stmt = $pdo->prepare("
            INSERT INTO appointments
                (patient_id, doctor_id, service_id, appointment_date, appointment_time, duration_minutes, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        ");
        $stmt->execute([$patientId, $doctorId, $serviceId, $date, $time, (int) $service['duration_minutes']]);
        $apptId = (int) $pdo->lastInsertId();

        // Update lead status and link to appointment
        $stmt = $pdo->prepare("
            UPDATE leads SET status = 'appointment_booked', appointment_id = ? WHERE id = ?
        ");
        $stmt->execute([$apptId, $leadId]);

        $pdo->commit();
        json_response(['data' => ['appointment_id' => $apptId, 'patient_id' => $patientId]]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

// ---------------------------------------------------------------------------
// GET /leads  – List with optional filters
// ---------------------------------------------------------------------------

if ($method === 'GET' && $id === null) {
    $where  = ['1=1'];
    $params = [];

    if (!empty($_GET['status']) && in_array($_GET['status'], $validStatuses, true)) {
        $where[]  = 'l.status = ?';
        $params[] = $_GET['status'];
    }
    if (!empty($_GET['search'])) {
        $q = '%' . $_GET['search'] . '%';
        $where[]  = '(l.first_name LIKE ? OR l.last_name LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)';
        $params   = array_merge($params, [$q, $q, $q, $q]);
    }

    $page    = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = 25;
    $offset  = ($page - 1) * $perPage;

    $whereClause = implode(' AND ', $where);

    // Count
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM leads l WHERE {$whereClause}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT l.id, l.first_name, l.last_name, l.email, l.phone,
               l.source, l.message, l.status, l.internal_notes,
               l.appointment_id, l.created_at, l.updated_at
        FROM leads l
        WHERE {$whereClause}
        ORDER BY l.created_at DESC
        LIMIT {$perPage} OFFSET {$offset}
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['id']             = (int) $row['id'];
        $row['appointment_id'] = $row['appointment_id'] ? (int) $row['appointment_id'] : null;
    }
    unset($row);

    json_response([
        'data' => $rows,
        'meta' => [
            'total' => $total,
            'page'  => $page,
            'pages' => (int) ceil($total / $perPage),
        ],
    ]);
}

// ---------------------------------------------------------------------------
// GET /leads/:id  – Single lead
// ---------------------------------------------------------------------------

if ($method === 'GET' && $id !== null) {
    $leadId = leads_positive_int($id);
    if (!$leadId) error_response('Invalid lead id', 400);

    $stmt = $pdo->prepare("
        SELECT id, first_name, last_name, email, phone, source, message,
               status, internal_notes, appointment_id, created_at, updated_at
        FROM leads WHERE id = ?
    ");
    $stmt->execute([$leadId]);
    $row = $stmt->fetch();

    if (!$row) error_response('Lead not found', 404);

    $row['id']             = (int) $row['id'];
    $row['appointment_id'] = $row['appointment_id'] ? (int) $row['appointment_id'] : null;

    json_response(['data' => $row]);
}

// ---------------------------------------------------------------------------
// PATCH /leads/:id  – Update status or internal notes
// ---------------------------------------------------------------------------

if ($method === 'PATCH' && $id !== null && !$isConvert) {
    $leadId = leads_positive_int($id);
    if (!$leadId) error_response('Invalid lead id', 400);

    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    $set    = [];
    $params = [];

    if (array_key_exists('status', $input)) {
        if (!in_array($input['status'], $validStatuses, true)) {
            error_response('Invalid status. Valid values: ' . implode(', ', $validStatuses), 422);
        }
        $set[]    = 'status = ?';
        $params[] = $input['status'];
    }

    if (array_key_exists('internal_notes', $input)) {
        $notes = is_string($input['internal_notes']) && trim($input['internal_notes']) !== ''
            ? mb_substr(trim($input['internal_notes']), 0, 5000)
            : null;
        $set[]    = 'internal_notes = ?';
        $params[] = $notes;
    }

    if (empty($set)) {
        error_response('Nothing to update. Provide status and/or internal_notes', 422);
    }

    $params[] = $leadId;
    $stmt = $pdo->prepare('UPDATE leads SET ' . implode(', ', $set) . ' WHERE id = ?');
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        error_response('Lead not found', 404);
    }

    // Return updated record
    $stmt = $pdo->prepare('SELECT id, status, internal_notes, updated_at FROM leads WHERE id = ?');
    $stmt->execute([$leadId]);
    $row = $stmt->fetch();
    $row['id'] = (int) $row['id'];

    json_response(['data' => $row]);
}

// ---------------------------------------------------------------------------
// Anything else
// ---------------------------------------------------------------------------
error_response('Method not allowed', 405);
