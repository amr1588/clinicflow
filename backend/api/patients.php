<?php
/**
 * Patients Endpoints
 *
 *   GET /patients           → Secretary: paginated patient list with search
 *   GET /patients/:id       → Secretary: single patient + appointment history summary
 *
 * @var PDO         $pdo
 * @var string|null $id
 */

declare(strict_types=1);

$method = $_SERVER['REQUEST_METHOD'];

// ---------------------------------------------------------------------------
// Both endpoints require a logged-in secretary
// ---------------------------------------------------------------------------
if (empty($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'secretary') {
    error_response('Access denied', 403);
}

// ---------------------------------------------------------------------------
// GET /patients  → paginated list with optional search
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id === null) {
    $search = trim($_GET['search'] ?? '');
    $page   = max(1, (int) ($_GET['page'] ?? 1));
    $limit  = 20;
    $offset = ($page - 1) * $limit;

    // Build WHERE clause for optional name/email search
    $where  = "WHERE u.role = 'patient'";
    $params = [];

    if ($search !== '') {
        $where    .= " AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)";
        $like      = "%{$search}%";
        $params    = [$like, $like, $like, $like];
    }

    // Total count for pagination
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM users u {$where}");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Patient rows with their appointment count
    $stmt = $pdo->prepare("
        SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone,
            u.is_active,
            u.created_at,
            COUNT(a.id) AS appointment_count
        FROM users u
        LEFT JOIN appointments a ON a.patient_id = u.id
        {$where}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT {$limit} OFFSET {$offset}
    ");
    $stmt->execute($params);
    $patients = $stmt->fetchAll();

    foreach ($patients as &$p) {
        $p['id']                = (int) $p['id'];
        $p['is_active']         = (int) $p['is_active'];
        $p['appointment_count'] = (int) $p['appointment_count'];
    }
    unset($p);

    json_response([
        'data' => $patients,
        'meta' => [
            'total'   => $total,
            'page'    => $page,
            'limit'   => $limit,
            'pages'   => (int) ceil($total / $limit),
        ],
    ]);
}

// ---------------------------------------------------------------------------
// GET /patients/:id  → single patient with recent appointment history
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id !== null) {
    $patientId = validate_id($id);

    // Patient must be a patient-role user
    $stmt = $pdo->prepare("
        SELECT id, first_name, last_name, email, phone, is_active, created_at
        FROM users
        WHERE id = ? AND role = 'patient'
    ");
    $stmt->execute([$patientId]);
    $patient = $stmt->fetch();

    if (!$patient) {
        error_response('Patient not found', 404);
    }

    $patient['id']        = (int) $patient['id'];
    $patient['is_active'] = (int) $patient['is_active'];

    // Last 20 appointments for this patient
    $aStmt = $pdo->prepare("
        SELECT
            a.id,
            a.appointment_date  AS date,
            a.appointment_time  AS time,
            a.status,
            a.duration_minutes,
            s.name              AS service_name,
            s.price,
            du.first_name       AS doctor_first_name,
            du.last_name        AS doctor_last_name
        FROM appointments a
        JOIN services s ON s.id  = a.service_id
        JOIN doctors  d ON d.id  = a.doctor_id
        JOIN users   du ON du.id = d.user_id
        WHERE a.patient_id = ?
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
        LIMIT 20
    ");
    $aStmt->execute([$patientId]);
    $appts = $aStmt->fetchAll();

    foreach ($appts as &$a) {
        $a['id']               = (int) $a['id'];
        $a['duration_minutes'] = (int) $a['duration_minutes'];
        $a['time']             = substr($a['time'], 0, 5);
    }
    unset($a);

    $patient['appointments'] = $appts;

    json_response(['data' => $patient]);
}

error_response('Not found', 404);
