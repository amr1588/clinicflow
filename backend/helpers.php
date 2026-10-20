<?php
/**
 * ClinicFlow - Shared Helpers
 * Generic response helpers, authorization checks, session guards, and common sanitizers.
 * 
 * Rule: code used by TWO or more api files goes here.
 * Code used by only ONE api file stays inside that file.
 */

declare(strict_types=1);

// ---------------------------------------------------------------------------
// JSON Response Helpers
// ---------------------------------------------------------------------------

/**
 * Send a JSON response and exit.
 *
 * @param mixed $data    The data to encode as JSON
 * @param int   $status  HTTP status code (default 200)
 */
function json_response(mixed $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Send a JSON error response and exit.
 *
 * @param string $message  Human-readable error message
 * @param int    $status   HTTP status code (default 400)
 * @param array  $extra    Optional extra fields to merge into the response
 */
function error_response(string $message, int $status = 400, array $extra = []): never
{
    http_response_code($status);
    echo json_encode(array_merge(['error' => $message], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------------------------------------------------------------------------
// HTTP Method Helper
// ---------------------------------------------------------------------------

/**
 * Reject the request if the HTTP method is not in the allowed list.
 * Returns 405 Method Not Allowed with an Allow header.
 *
 * @param array $allowed  e.g. ['GET', 'POST']
 */
function require_method(array $allowed): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'], $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        error_response('Method not allowed', 405);
    }
}

// ---------------------------------------------------------------------------
// Authentication & Authorization Guards (used from Phase 3 onward)
// ---------------------------------------------------------------------------

/**
 * Require the user to be logged in. Returns the session user data.
 * Sends 401 if not authenticated.
 *
 * @return array  The authenticated user's session data
 */
function require_login(): array
{
    if (empty($_SESSION['user'])) {
        error_response('Authentication required', 401);
    }
    return $_SESSION['user'];
}

/**
 * Require the user to have one of the specified roles.
 * Must be called AFTER require_login().
 * Sends 403 if the user's role is not in the allowed list.
 *
 * @param array $roles  e.g. ['secretary', 'doctor']
 * @param array $user   The user data from require_login()
 */
function require_role(array $roles, array $user): void
{
    if (!in_array($user['role'], $roles, true)) {
        error_response('Access denied: insufficient permissions', 403);
    }
}

// ---------------------------------------------------------------------------
// Input Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Parse and validate a positive integer ID (e.g. from URL segments).
 * Returns the integer or sends a 400 error.
 */
function validate_id(mixed $value): int
{
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false) {
        error_response('Invalid ID: must be a positive integer', 400);
    }
    return $id;
}

/**
 * Read and decode the JSON request body.
 * Returns the decoded associative array or sends a 400 error.
 */
function get_json_body(): array
{
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        error_response('Invalid JSON in request body', 400);
    }
    return $data;
}

/**
 * Trim and sanitize a string value. Returns null if empty after trimming.
 */
function sanitize_string(mixed $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    $cleaned = trim((string) $value);
    return $cleaned === '' ? null : $cleaned;
}

/**
 * Validate that an email address is well-formed.
 * Returns the sanitized email or sends a 422 error.
 */
function validate_email(string $email): string
{
    $email = trim(strtolower($email));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_response('Invalid email address', 422);
    }
    return $email;
}
