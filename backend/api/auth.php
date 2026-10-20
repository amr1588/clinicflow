<?php
declare(strict_types=1);

/**
 * Auth Endpoints
 *
 *   POST /auth/register  -> create a patient account and log in
 *   POST /auth/login     -> log in
 *   GET  /auth/me        -> current logged-in user
 *   POST /auth/logout    -> log out
 *
 * $pdo and $id are provided by the front controller (public/index.php).
 * For this file, $id is the ACTION (register, login, me, logout).
 */

$action = $id;
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
if ($action === 'register' && $method === 'POST') {
    $first = trim($input['first_name'] ?? '');
    $last = trim($input['last_name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    $phone = trim($input['phone'] ?? '');
    $password = $input['password'] ?? '';

    if ($first === '' || $last === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
        error_response('Please provide valid name, email and a password of at least 8 characters', 422);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    // Role is ALWAYS 'patient'. Never read it from the request.
    $stmt = $pdo->prepare("
        INSERT INTO users (first_name, last_name, email, phone, password_hash, role)
        VALUES (?, ?, ?, ?, ?, 'patient')
    ");

    try {
        $stmt->execute([$first, $last, $email, $phone !== '' ? $phone : null, $hash]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {   // duplicate email (uq_users_email)
            error_response('This email is already registered', 409);
        }
        throw $e;
    }

    $userId = (int) $pdo->lastInsertId();

    session_regenerate_id(true);   // prevents session fixation
    $_SESSION['user_id'] = $userId;
    $_SESSION['role'] = 'patient';

    json_response([
        'data' => [
            'id' => $userId,
            'first_name' => $first,
            'last_name' => $last,
            'email' => $email,
            'role' => 'patient',
        ]
    ], 201);
}

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
if ($action === 'login' && $method === 'POST') {
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';

    $stmt = $pdo->prepare("
        SELECT id, first_name, last_name, email, password_hash, role, is_active
        FROM users
        WHERE email = ?
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Same message for wrong email and wrong password, so attackers can't tell which
    if (!$user || !$user['is_active'] || !password_verify($password, $user['password_hash'])) {
        error_response('Invalid email or password', 401);
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['role'] = $user['role'];

    json_response([
        'data' => [
            'id' => (int) $user['id'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'email' => $user['email'],
            'role' => $user['role'],
        ]
    ]);
}

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
if ($action === 'me' && $method === 'GET') {
    if (empty($_SESSION['user_id'])) {
        error_response('Not authenticated', 401);
    }

    $stmt = $pdo->prepare("
        SELECT id, first_name, last_name, email, role
        FROM users
        WHERE id = ? AND is_active = 1
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        error_response('Not authenticated', 401);
    }

    $user['id'] = (int) $user['id'];
    json_response(['data' => $user]);
}

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------
if ($action === 'logout' && $method === 'POST') {
    $_SESSION = [];

    // Also remove the session cookie from the browser
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }

    session_destroy();
    json_response(['data' => ['message' => 'Logged out']]);
}

// ---------------------------------------------------------------------------
// Anything else
// ---------------------------------------------------------------------------
error_response('Not found', 404);