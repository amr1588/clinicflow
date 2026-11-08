<?php

/**
 * Services Endpoints
 *
 * Public:
 *   GET /services       → All active services
 *   GET /services/:id   → Single active service
 *
 * Secretary only:
 *   POST  /services     → Create a new service
 *   PATCH /services/:id → Update a service or toggle is_active
 *
 * @var PDO         $pdo
 * @var string|null $id
 */

declare(strict_types=1);

$method = $_SERVER['REQUEST_METHOD'];

// ---------------------------------------------------------------------------
// GET /services — All active services (public)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id === null) {
    $stmt = $pdo->query("
        SELECT id, name, description, price, duration_minutes, is_active
        FROM services
        WHERE is_active = 1
        ORDER BY name
    ");
    $services = $stmt->fetchAll();
    foreach ($services as &$s) {
        $s['id']               = (int) $s['id'];
        $s['duration_minutes'] = (int) $s['duration_minutes'];
        $s['is_active']        = (int) $s['is_active'];
    }
    unset($s);
    json_response(['data' => $services]);
}

// ---------------------------------------------------------------------------
// GET /services/:id — Single active service (public)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $id !== null) {
    $serviceId = validate_id($id);
    $stmt = $pdo->prepare("
        SELECT id, name, description, price, duration_minutes, is_active
        FROM services
        WHERE id = ? AND is_active = 1
    ");
    $stmt->execute([$serviceId]);
    $service = $stmt->fetch();
    if (!$service) {
        error_response('Service not found', 404);
    }
    $service['id']               = (int) $service['id'];
    $service['duration_minutes'] = (int) $service['duration_minutes'];
    $service['is_active']        = (int) $service['is_active'];
    json_response(['data' => $service]);
}

// ---------------------------------------------------------------------------
// Secretary-only endpoints
// ---------------------------------------------------------------------------
if (empty($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'secretary') {
    error_response('Access denied', 403);
}

$input = get_json_body();

// ---------------------------------------------------------------------------
// POST /services — Secretary creates a new service
// ---------------------------------------------------------------------------
if ($method === 'POST' && $id === null) {
    $name     = sanitize_string($input['name'] ?? null);
    $desc     = sanitize_string($input['description'] ?? null);
    $price    = filter_var($input['price'] ?? null, FILTER_VALIDATE_FLOAT);
    $duration = filter_var($input['duration_minutes'] ?? null, FILTER_VALIDATE_INT);

    if (!$name)                       error_response('Service name is required', 422);
    if ($price === false || $price < 0) error_response('Invalid price', 422);
    if ($duration === false || $duration < 5) error_response('Duration must be at least 5 minutes', 422);

    $stmt = $pdo->prepare("
        INSERT INTO services (name, description, price, duration_minutes)
        VALUES (?, ?, ?, ?)
    ");
    $stmt->execute([$name, $desc, $price, $duration]);
    $serviceId = (int) $pdo->lastInsertId();

    json_response([
        'data' => [
            'id'               => $serviceId,
            'name'             => $name,
            'price'            => number_format($price, 2, '.', ''),
            'duration_minutes' => $duration,
        ],
    ], 201);
}

// ---------------------------------------------------------------------------
// PATCH /services/:id — Secretary updates a service or toggles is_active
// ---------------------------------------------------------------------------
if ($method === 'PATCH' && $id !== null) {
    $serviceId = validate_id($id);

    $stmt = $pdo->prepare("SELECT id FROM services WHERE id = ?");
    $stmt->execute([$serviceId]);
    if (!$stmt->fetch()) {
        error_response('Service not found', 404);
    }

    $sets   = [];
    $params = [];

    if (isset($input['name'])) {
        $val = sanitize_string($input['name']);
        if (!$val) error_response('name cannot be empty', 422);
        $sets[]   = 'name = ?';
        $params[] = $val;
    }
    if (array_key_exists('description', $input)) {
        $sets[]   = 'description = ?';
        $params[] = sanitize_string($input['description']);
    }
    if (isset($input['price'])) {
        $price = filter_var($input['price'], FILTER_VALIDATE_FLOAT);
        if ($price === false || $price < 0) error_response('Invalid price', 422);
        $sets[]   = 'price = ?';
        $params[] = $price;
    }
    if (isset($input['duration_minutes'])) {
        $dur = filter_var($input['duration_minutes'], FILTER_VALIDATE_INT);
        if ($dur === false || $dur < 5) error_response('Duration must be at least 5 minutes', 422);
        $sets[]   = 'duration_minutes = ?';
        $params[] = $dur;
    }
    if (isset($input['is_active'])) {
        $sets[]   = 'is_active = ?';
        $params[] = $input['is_active'] ? 1 : 0;
    }

    if (empty($sets)) {
        error_response('No fields to update', 422);
    }

    $params[] = $serviceId;
    $pdo->prepare("UPDATE services SET " . implode(', ', $sets) . " WHERE id = ?")
        ->execute($params);

    json_response(['data' => ['id' => $serviceId, 'updated' => true]]);
}

error_response('Not found', 404);