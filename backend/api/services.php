<?php
declare(strict_types=1);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && $id === null) {
    $stmt = $pdo->query("
        SELECT id, name, description, price, duration_minutes
        FROM services
        WHERE is_active = 1
        ORDER BY name
    ");
    $services = $stmt->fetchAll();
    foreach ($services as &$s) {
        $s['id'] = (int) $s['id'];
        $s['duration_minutes'] = (int) $s['duration_minutes'];
    }
    unset($s);
    json_response(['data' => $services]);
}

if ($method === 'GET' && $id !== null) {
    $serviceId = validate_id($id);
    $stmt = $pdo->prepare("
        SELECT id, name, description, price, duration_minutes
        FROM services
        WHERE id = ? AND is_active = 1
    ");
    $stmt->execute([$serviceId]);
    $service = $stmt->fetch();
    if (!$service) {
        error_response('Service not found', 404);
    }
    $service['id'] = (int) $service['id'];
    $service['duration_minutes'] = (int) $service['duration_minutes'];
    json_response(['data' => $service]);
}

require_method(['GET']);