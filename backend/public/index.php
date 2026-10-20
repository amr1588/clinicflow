<?php
/**
 * ClinicFlow - Single Entry Point & Router (Front Controller)
 * 
 * All HTTP requests hit this file. It:
 * 1. Loads config, database, and helpers
 * 2. Sets security headers and CORS
 * 3. Starts a secure session
 * 4. Parses the URL into resource + optional ID
 * 5. Includes the matching api/ file
 * 6. Returns 404 JSON for unknown resources
 */

declare(strict_types=1);

// ---------------------------------------------------------------------------
// PHP built-in server: serve static files directly (CSS, JS, images)
// When using `php -S`, returning false tells it to handle the file itself.
// ---------------------------------------------------------------------------
if (PHP_SAPI === 'cli-server') {
    $requestedPath = __DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if (is_file($requestedPath)) {
        return false;
    }
}

// ---------------------------------------------------------------------------
// 1. Load configuration, database connection, and helpers
// ---------------------------------------------------------------------------
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../helpers.php';

// ---------------------------------------------------------------------------
// 2. Global JSON error handler
//    Catches unexpected errors/exceptions and returns JSON instead of HTML.
//    In production, hides error details. In development, includes the message.
// ---------------------------------------------------------------------------
set_exception_handler(function (Throwable $e) {
    error_log('Uncaught exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());

    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');

    $response = ['error' => 'Internal server error'];
    if (APP_DEBUG) {
        $response['debug'] = $e->getMessage();
        $response['file']  = $e->getFile() . ':' . $e->getLine();
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
});

set_error_handler(function (int $severity, string $message, string $file, int $line) {
    // Convert PHP warnings/notices to exceptions so they're caught above
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// ---------------------------------------------------------------------------
// 3. Security headers & CORS
// ---------------------------------------------------------------------------
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// CORS: Allow requests from the Next.js frontend
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [FRONTEND_URL];

if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
}

// Handle CORS preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------------
// 4. Session setup (secure defaults)
// ---------------------------------------------------------------------------
session_name(SESSION_NAME);
session_set_cookie_params([
    'lifetime' => SESSION_LIFETIME,
    'path'     => '/',
    'domain'   => '',
    'secure'   => SESSION_SECURE,       // true in production (HTTPS)
    'httponly'  => true,                 // JS can't read the session cookie
    'samesite'  => 'Lax',              // CSRF protection
]);
session_start();

// ---------------------------------------------------------------------------
// 5. Route the request
//    Parse the URL path, strip the base path, and map to an api/ file.
//    Example: /doctors/3  →  resource="doctors", id="3"
//             /auth/login →  resource="auth",    id="login"
// ---------------------------------------------------------------------------
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Remove the base path prefix (e.g., '/clinicflow/backend/public' or just '/')
if (APP_BASE_PATH !== '' && str_starts_with($requestUri, APP_BASE_PATH)) {
    $requestUri = substr($requestUri, strlen(APP_BASE_PATH));
}

// Clean up: trim slashes, split into segments
$path     = trim($requestUri, '/');
$segments = $path !== '' ? explode('/', $path) : [];

$resource = $segments[0] ?? null;
$id       = $segments[1] ?? null;

// No resource specified → API info
if ($resource === null || $resource === '') {
    json_response([
        'name'    => 'ClinicFlow API',
        'version' => '1.0.0',
        'status'  => 'running',
    ]);
}

// Map resource to api file
$allowed = ['auth', 'doctors', 'services', 'appointments', 'leads', 'patients', 'consultations'];

if (!in_array($resource, $allowed, true)) {
    error_response('Not found', 404);
}

$apiFile = __DIR__ . '/../api/' . $resource . '.php';

if (!file_exists($apiFile)) {
    error_response("Resource '{$resource}' not found", 404);
}

// Make $pdo and $id available to the api file
// ($pdo is already in scope from db.php, $id is set above)
require $apiFile;
