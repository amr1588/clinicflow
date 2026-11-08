<?php
declare(strict_types=1);

/**
 * Auth Endpoints
 *
 *   POST  /auth/register         create a patient account and log in
 *   POST  /auth/login            log in
 *   GET   /auth/me               current logged-in user
 *   PATCH /auth/me               update own profile
 *   POST  /auth/logout           log out
 *   POST  /auth/forgot-password  email a 6-digit reset code
 *   POST  /auth/reset-password   set a new password using the code
 *
 * $pdo and $id are provided by the front controller (public/index.php).
 * For this file, $id is the ACTION (register, login, me, logout, ...).
 *
 * @var PDO $pdo
 * @var string|null $id
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
// GET /auth/me  -> current logged-in user
// ---------------------------------------------------------------------------
if ($action === 'me' && $method === 'GET') {
    if (empty($_SESSION['user_id'])) {
        error_response('Not authenticated', 401);
    }

    $stmt = $pdo->prepare("
        SELECT id, first_name, last_name, email, phone, role
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
// PATCH /auth/me  -> update the logged-in user's own profile
// ---------------------------------------------------------------------------
if ($action === 'me' && $method === 'PATCH') {
    if (empty($_SESSION['user_id'])) {
        error_response('Not authenticated', 401);
    }

    $first = trim($input['first_name'] ?? '');
    $last = trim($input['last_name'] ?? '');
    $phone = trim($input['phone'] ?? '');

    if ($first === '' || $last === '') {
        error_response('First name and last name are required', 422);
    }

    // The id comes from the SESSION, never from the request,
    // so a user can only ever update their own row.
    $stmt = $pdo->prepare("
        UPDATE users
        SET first_name = ?, last_name = ?, phone = ?
        WHERE id = ? AND is_active = 1
    ");
    $stmt->execute([$first, $last, $phone !== '' ? $phone : null, $_SESSION['user_id']]);

    $stmt = $pdo->prepare("
        SELECT id, first_name, last_name, email, phone, role
        FROM users
        WHERE id = ?
    ");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
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
// POST /auth/forgot-password   body: {"email": "..."}
// Always answers with the same message, so nobody can learn which emails exist.
// ---------------------------------------------------------------------------
if ($action === 'forgot-password' && $method === 'POST') {
    $email = strtolower(trim($input['email'] ?? ''));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_response('Please provide a valid email', 422);
    }

    $genericMessage = 'If the email is registered, a verification code has been sent.';

    $stmt = $pdo->prepare("SELECT id, first_name FROM users WHERE email = ? AND is_active = 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user) {
        // Cooldown: at most one code per minute per user (stops email flooding)
        $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM password_resets
            WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND)
        ");
        $stmt->execute([$user['id']]);

        if ((int) $stmt->fetchColumn() === 0) {
            // 6-digit code, keeping leading zeros
            $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            // Invalidate older unused codes for this user
            $pdo->prepare("UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL")
                ->execute([$user['id']]);

            // MySQL's own clock decides expiry, so PHP and MySQL time zones can't disagree
            $pdo->prepare("
                INSERT INTO password_resets (user_id, otp_hash, expires_at)
                VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
            ")->execute([$user['id'], hash('sha256', $otp)]);

            require_once __DIR__ . '/../mail.php';

            $name = htmlspecialchars($user['first_name'], ENT_QUOTES, 'UTF-8');
            $html = "
                <div style='font-family: Arial, sans-serif; padding: 20px; color: #333;'>
                    <h2>Password reset request</h2>
                    <p>Hello {$name},</p>
                    <p>We received a request to reset your ClinicFlow password. Your verification code is:</p>
                    <h1 style='color: #2563eb; letter-spacing: 5px; font-size: 36px;'>{$otp}</h1>
                    <p>This code expires in <strong>10 minutes</strong>.</p>
                    <p>If you didn't request this, you can safely ignore this email.</p>
                </div>
            ";

            send_brevo_email($email, $user['first_name'], 'Your password reset code', $html);
        }
    }

    json_response(['data' => ['message' => $genericMessage]]);
}

// ---------------------------------------------------------------------------
// POST /auth/reset-password   body: {"email", "otp", "new_password"}
// ---------------------------------------------------------------------------
if ($action === 'reset-password' && $method === 'POST') {
    $email = strtolower(trim($input['email'] ?? ''));
    $otp = trim((string) ($input['otp'] ?? ''));
    $newPassword = (string) ($input['new_password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{6}$/', $otp)) {
        error_response('Please provide a valid email and the 6-digit code', 422);
    }
    if (strlen($newPassword) < 8) {
        error_response('Password must be at least 8 characters', 422);
    }

    $invalid = 'Invalid or expired verification code.';

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND is_active = 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        error_response($invalid, 400);
    }

    // Latest code that is unused and not expired
    $stmt = $pdo->prepare("
        SELECT id, otp_hash, attempts, max_attempts
        FROM password_resets
        WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
    ");
    $stmt->execute([$user['id']]);
    $record = $stmt->fetch();

    if (!$record) {
        error_response($invalid, 400);
    }

    // Too many wrong guesses: burn this code, a new one must be requested
    if ((int) $record['attempts'] >= (int) $record['max_attempts']) {
        $pdo->prepare("UPDATE password_resets SET used_at = NOW() WHERE id = ?")
            ->execute([$record['id']]);
        error_response('Too many attempts. Please request a new code.', 429);
    }

    // hash_equals compares in constant time
    if (!hash_equals($record['otp_hash'], hash('sha256', $otp))) {
        $pdo->prepare("UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?")
            ->execute([$record['id']]);
        error_response($invalid, 400);
    }

    // Code is valid: change the password and burn the codes together
    try {
        $pdo->beginTransaction();

        $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?")
            ->execute([password_hash($newPassword, PASSWORD_DEFAULT), $user['id']]);

        $pdo->prepare("UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL")
            ->execute([$user['id']]);

        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    json_response(['data' => ['message' => 'Password updated successfully. You can now log in.']]);
}

// ---------------------------------------------------------------------------
// Anything else
// ---------------------------------------------------------------------------
error_response('Not found', 404);