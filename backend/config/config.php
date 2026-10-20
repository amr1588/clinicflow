<?php
/**
 * ClinicFlow - Environment & App Configuration
 * Reads .env file and defines app-wide constants/settings.
 *
 * Why parse .env manually? We're keeping it simple with no Composer/vendor
 * dependencies. This parser handles KEY=VALUE lines, ignores comments and
 * blank lines, and strips optional quotes from values.
 */

declare(strict_types=1);

// ---------------------------------------------------------------------------
// 1. Load .env file into $_ENV
// ---------------------------------------------------------------------------
$envPath = dirname(__DIR__) . '/.env';

if (!file_exists($envPath)) {
    // If .env is missing, the app can't run — fail loudly in dev
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error: .env file not found']);
    exit;
}

$lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
foreach ($lines as $line) {
    $line = trim($line);

    // Skip comments and empty lines
    if ($line === '' || $line[0] === '#') {
        continue;
    }

    // Split on first '=' only (values may contain '=')
    $eqPos = strpos($line, '=');
    if ($eqPos === false) {
        continue;
    }

    $key   = trim(substr($line, 0, $eqPos));
    $value = trim(substr($line, $eqPos + 1));

    // Strip surrounding quotes (single or double)
    if (
        strlen($value) >= 2 &&
        (($value[0] === '"' && $value[-1] === '"') ||
         ($value[0] === "'" && $value[-1] === "'"))
    ) {
        $value = substr($value, 1, -1);
    }

    $_ENV[$key] = $value;
}

// ---------------------------------------------------------------------------
// 2. Helper to read an env value with an optional default
// ---------------------------------------------------------------------------
function env(string $key, string $default = ''): string
{
    return $_ENV[$key] ?? $default;
}

// ---------------------------------------------------------------------------
// 3. App-wide settings derived from .env
// ---------------------------------------------------------------------------

// Core
define('APP_ENV',       env('APP_ENV', 'production'));
define('APP_DEBUG',     env('APP_DEBUG', 'false') === 'true');
define('APP_BASE_PATH', rtrim(env('APP_BASE_PATH', '/'), '/'));
define('FRONTEND_URL',  env('FRONTEND_URL', 'http://localhost:3000'));

// Database
define('DB_HOST', env('DB_HOST', '127.0.0.1'));
define('DB_PORT', env('DB_PORT', '3306'));
define('DB_NAME', env('DB_NAME', 'clinicflow'));
define('DB_USER', env('DB_USER', 'root'));
define('DB_PASS', env('DB_PASS', ''));

// Session
define('SESSION_NAME',     env('SESSION_NAME', 'clinicflow_session'));
define('SESSION_LIFETIME', (int) env('SESSION_LIFETIME', '86400'));
define('SESSION_SECURE',   env('SESSION_SECURE', 'false') === 'true');

// Mail / Brevo
define('BREVO_API_KEY',    env('BREVO_API_KEY'));
define('MAIL_FROM_EMAIL',  env('MAIL_FROM_EMAIL'));
define('MAIL_FROM_NAME',   env('MAIL_FROM_NAME'));
define('SECRETARY_EMAIL',  env('SECRETARY_EMAIL'));
