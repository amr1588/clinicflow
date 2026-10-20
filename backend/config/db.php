<?php
/**
 * ClinicFlow - Database Connection (PDO)
 * Creates a single PDO instance with secure defaults.
 *
 * Key settings:
 * - ERRMODE_EXCEPTION: PDO throws exceptions on errors (caught by our global handler)
 * - FETCH_ASSOC: rows come back as associative arrays by default
 * - EMULATE_PREPARES off: uses real prepared statements for security
 * - charset=utf8mb4: full Unicode support (emojis, accented chars, etc.)
 */

declare(strict_types=1);

// config.php must be loaded before this file (provides DB_* constants)

try {
    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        DB_HOST,
        DB_PORT,
        DB_NAME
    );

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    // Never expose database errors to the client
    // Log the real error in development, show a generic message always
    if (APP_DEBUG) {
        error_log('Database connection failed: ' . $e->getMessage());
    }

    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed. Please try again later.']);
    exit;
}
