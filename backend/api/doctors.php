<?php
/**
 * Doctors Endpoints
 * 
 * Public:
 *   GET /doctors      → List all active doctors (with specialty, fee, services)
 *   GET /doctors/:id  → Single active doctor detail
 *
 * Future phases will add secretary management endpoints (POST, PUT, PATCH).
 */

declare(strict_types=1);

// $pdo and $id are provided by the front controller (public/index.php)

$method = $_SERVER['REQUEST_METHOD'];

// ---------------------------------------------------------------------------
// GET /doctors — List all active doctors
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

    // Attach each doctor's services as a nested array
    // We do one extra query rather than a complex JOIN that would duplicate doctor rows
    if (!empty($doctors)) {
        $doctorIds = array_column($doctors, 'id');
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

        // Group services by doctor_id
        $servicesByDoctor = [];
        foreach ($allServices as $svc) {
            $servicesByDoctor[$svc['doctor_id']][] = [
                'id'               => (int) $svc['service_id'],
                'name'             => $svc['service_name'],
                'price'            => $svc['price'],
                'duration_minutes' => (int) $svc['duration_minutes'],
            ];
        }

        // Merge services into each doctor
        foreach ($doctors as &$doc) {
            $doc['id']                    = (int) $doc['id'];
            $doc['consultation_fee']      = $doc['consultation_fee'];
            $doc['consultation_duration'] = (int) $doc['consultation_duration'];
            $doc['services']              = $servicesByDoctor[$doc['id']] ?? [];
        }
        unset($doc); // break reference
    }

    json_response(['data' => $doctors]);
}

// ---------------------------------------------------------------------------
// GET /doctors/:id — Single active doctor with full details
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

    // Cast numeric fields
    $doctor['id']                    = (int) $doctor['id'];
    $doctor['consultation_duration'] = (int) $doctor['consultation_duration'];

    // Fetch this doctor's services
    $svcStmt = $pdo->prepare("
        SELECT 
            s.id,
            s.name,
            s.description,
            s.price,
            s.duration_minutes
        FROM doctor_services ds
        JOIN services s ON s.id = ds.service_id
        WHERE ds.doctor_id = ?
          AND s.is_active = 1
        ORDER BY s.name
    ");
    $svcStmt->execute([$doctorId]);
    $services = $svcStmt->fetchAll();

    // Cast numeric fields in services
    foreach ($services as &$svc) {
        $svc['id']               = (int) $svc['id'];
        $svc['duration_minutes'] = (int) $svc['duration_minutes'];
    }
    unset($svc);

    $doctor['services'] = $services;

    // Fetch working hours
    $whStmt = $pdo->prepare("
        SELECT day_of_week, start_time, end_time
        FROM doctor_working_hours
        WHERE doctor_id = ?
        ORDER BY day_of_week, start_time
    ");
    $whStmt->execute([$doctorId]);
    $workingHours = $whStmt->fetchAll();

    // Cast day_of_week to int
    foreach ($workingHours as &$wh) {
        $wh['day_of_week'] = (int) $wh['day_of_week'];
    }
    unset($wh);

    $doctor['working_hours'] = $workingHours;

    json_response(['data' => $doctor]);
}

// ---------------------------------------------------------------------------
// Any other method → 405
// ---------------------------------------------------------------------------
require_method(['GET']);
