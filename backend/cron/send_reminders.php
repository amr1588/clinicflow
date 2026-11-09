<?php
declare(strict_types=1);

/**
 * Sends a reminder email for every CONFIRMED appointment happening tomorrow.
 * Run it once a day (see the Task Scheduler steps below).
 *
 *   php cron/send_reminders.php
 *
 * Each appointment gets only one reminder: reminder_sent_at is set after a
 * successful send, and appointments that already have it are skipped.
 */

// This script must only run from the command line, never from a browser
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden');
}

date_default_timezone_set('Africa/Cairo');

require __DIR__ . '/../config/config.php';
require __DIR__ . '/../config/db.php';
require __DIR__ . '/../mail.php';

/** @var PDO $pdo */

$tomorrow = (new DateTimeImmutable('tomorrow'))->format('Y-m-d');

$stmt = $pdo->prepare("
    SELECT id
    FROM appointments
    WHERE appointment_date = ?
      AND status = 'confirmed'
      AND reminder_sent_at IS NULL
    ORDER BY appointment_time
");
$stmt->execute([$tomorrow]);
$ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

echo '[' . date('Y-m-d H:i:s') . "] Appointments to remind for {$tomorrow}: " . count($ids) . PHP_EOL;

$sent   = 0;
$failed = 0;

foreach ($ids as $appointmentId) {
    $appointmentId = (int) $appointmentId;

    try {
        if (notify_appointment_reminder($pdo, $appointmentId)) {
            $pdo->prepare("UPDATE appointments SET reminder_sent_at = NOW() WHERE id = ?")
                ->execute([$appointmentId]);
            $sent++;
        } else {
            // Not marked as sent, so the next run will try again
            $failed++;
        }
    } catch (Throwable $e) {
        error_log("Reminder for appointment {$appointmentId} failed: " . $e->getMessage());
        $failed++;
    }
}

echo "Sent: {$sent}, failed: {$failed}" . PHP_EOL;