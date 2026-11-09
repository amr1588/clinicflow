<?php
declare(strict_types=1);

/**
 * Brevo transactional email (REST API) + the appointment email templates.
 *
 * Uses the constants defined in config/config.php:
 *   BREVO_API_KEY, MAIL_FROM_EMAIL, MAIL_FROM_NAME, SECRETARY_EMAIL, FRONTEND_URL
 *
 * Returns true on success and false on failure. Failures are only written to
 * the PHP error log (the terminal running `php -S`); nothing about them is
 * ever shown to the user.
 */

function send_brevo_email(string $toEmail, string $toName, string $subject, string $html): bool
{
    if (BREVO_API_KEY === '' || MAIL_FROM_EMAIL === '') {
        error_log('Brevo: BREVO_API_KEY or MAIL_FROM_EMAIL is empty in .env');
        return false;
    }

    $payload = [
        'sender' => [
            'name' => MAIL_FROM_NAME !== '' ? MAIL_FROM_NAME : 'ClinicFlow',
            'email' => MAIL_FROM_EMAIL,
        ],
        'to' => [['email' => $toEmail, 'name' => $toName]],
        'subject' => $subject,
        'htmlContent' => $html,
    ];

    $ch = curl_init('https://api.brevo.com/v3/smtp/email');
    $curlOptions = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'accept: application/json',
            'api-key: ' . BREVO_API_KEY,
            'content-type: application/json',
        ],
        CURLOPT_TIMEOUT => 10,
    ];

    // In development or local environments where CA certificates might be missing or misconfigured,
    // disable SSL peer verification so email delivery does not silently fail.
    if (defined('APP_ENV') && APP_ENV === 'development') {
        $curlOptions[CURLOPT_SSL_VERIFYPEER] = false;
        $curlOptions[CURLOPT_SSL_VERIFYHOST] = 0;
    }

    curl_setopt_array($ch, $curlOptions);

    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    $curlErrno = curl_errno($ch);

    // If verification failed due to missing local issuer cert, retry with SSL verification bypassed
    if ($response === false && in_array($curlErrno, [60, 77], true)) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        $response = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
    }

    curl_close($ch);

    if ($response === false || $status < 200 || $status >= 300) {
        error_log("Brevo send failed (HTTP {$status}): {$curlError} {$response}");
        return false;
    }

    return true;
}

// ---------------------------------------------------------------------------
// Small helpers for building the emails
// ---------------------------------------------------------------------------

/** Escapes text before it goes into HTML (names and reasons come from users). */
function mail_h(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

/** Wraps the content of an email in a simple, consistent layout. */
function mail_layout(string $title, string $content): string
{
    $title = mail_h($title);

    return "
        <div style='font-family: Arial, sans-serif; background: #f8fafc; padding: 24px;'>
            <div style='max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #0f172a;'>
                <h2 style='margin: 0 0 16px; color: #2563eb;'>{$title}</h2>
                {$content}
                <p style='margin: 24px 0 0; font-size: 12px; color: #94a3b8;'>ClinicFlow Medical Center</p>
            </div>
        </div>
    ";
}

/** Builds a two-column details table from label => value pairs (values already escaped). */
function mail_details_table(array $rows): string
{
    $html = "<table style='width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;'>";
    foreach ($rows as $label => $value) {
        $html .= "
            <tr>
                <td style='padding: 8px 0; color: #64748b; width: 38%; vertical-align: top;'>" . mail_h($label) . "</td>
                <td style='padding: 8px 0; color: #0f172a; font-weight: bold;'>{$value}</td>
            </tr>";
    }
    return $html . '</table>';
}

function mail_button(string $url, string $label): string
{
    return "<p style='margin: 20px 0 0;'>
        <a href='" . mail_h($url) . "' style='display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px;'>"
        . mail_h($label) . "</a></p>";
}

/** Loads one appointment with everything an email needs, already formatted. */
function mail_load_appointment(PDO $pdo, int $appointmentId): ?array
{
    $stmt = $pdo->prepare("
        SELECT a.appointment_date, a.appointment_time, a.duration_minutes,
               a.reason, a.cancellation_reason,
               pu.first_name AS p_first, pu.last_name AS p_last,
               pu.email      AS p_email, pu.phone     AS p_phone,
               du.first_name AS d_first, du.last_name AS d_last,
               d.specialty,
               s.name AS service_name, s.price
        FROM appointments a
        JOIN users   pu ON pu.id = a.patient_id
        JOIN doctors d  ON d.id  = a.doctor_id
        JOIN users   du ON du.id = d.user_id
        JOIN services s ON s.id  = a.service_id
        WHERE a.id = ?
    ");
    $stmt->execute([$appointmentId]);
    $a = $stmt->fetch();

    if (!$a) {
        return null;
    }

    $when = new DateTimeImmutable($a['appointment_date'] . ' ' . $a['appointment_time']);

    return [
        'p_first' => $a['p_first'],
        'patient' => $a['p_first'] . ' ' . $a['p_last'],
        'p_email' => $a['p_email'],
        'p_phone' => $a['p_phone'],
        'doctor' => 'Dr. ' . $a['d_first'] . ' ' . $a['d_last'],
        'specialty' => $a['specialty'],
        'service' => $a['service_name'],
        'when' => $when,
        'date_text' => $when->format('l, j F Y'),
        'time_text' => $when->format('g:i A'),
        'duration' => (int) $a['duration_minutes'],
        'price_text' => 'EGP ' . number_format((float) $a['price'], 0),
        'reason' => $a['reason'],
        'cancellation_reason' => $a['cancellation_reason'],
    ];
}

// ---------------------------------------------------------------------------
// New appointment: one email to the patient, one to the secretary
// ---------------------------------------------------------------------------

/**
 * Call this right after an appointment is created. It loads the details itself,
 * so the caller only passes the appointment id.
 */
function notify_new_appointment(PDO $pdo, int $appointmentId): void
{
    $a = mail_load_appointment($pdo, $appointmentId);
    if (!$a) {
        return;
    }

    $baseUrl = rtrim(FRONTEND_URL, '/');

    // ---- 1. Email to the patient ---------------------------------------
    $patientRows = [
        'Doctor' => mail_h($a['doctor']) . ' (' . mail_h($a['specialty']) . ')',
        'Service' => mail_h($a['service']),
        'Date' => mail_h($a['date_text']),
        'Time' => mail_h($a['time_text']),
        'Duration' => $a['duration'] . ' min',
        'Price' => mail_h($a['price_text']),
        'Status' => 'Pending confirmation',
    ];

    $patientHtml = mail_layout(
        'We received your appointment request',
        "<p>Hello " . mail_h($a['p_first']) . ",</p>
         <p>Thank you for booking with us. The clinic will review your request and confirm it shortly.
            You will get another email once it is confirmed.</p>"
        . mail_details_table($patientRows)
        . mail_button($baseUrl . '/patient/appointments', 'View my appointments')
    );

    send_brevo_email($a['p_email'], $a['patient'], 'Your appointment request was received', $patientHtml);

    // ---- 2. Email to the secretary --------------------------------------
    if (SECRETARY_EMAIL !== '' && filter_var(SECRETARY_EMAIL, FILTER_VALIDATE_EMAIL)) {
        $secretaryRows = [
            'Patient' => mail_h($a['patient']),
            'Email' => mail_h($a['p_email']),
            'Phone' => $a['p_phone'] ? mail_h($a['p_phone']) : '-',
            'Doctor' => mail_h($a['doctor']),
            'Service' => mail_h($a['service']),
            'Date' => mail_h($a['date_text']),
            'Time' => mail_h($a['time_text']),
            'Reason' => $a['reason'] ? mail_h($a['reason']) : '-',
        ];

        $secretaryHtml = mail_layout(
            'New appointment request',
            "<p>A new appointment is waiting for confirmation.</p>"
            . mail_details_table($secretaryRows)
            . mail_button($baseUrl . '/secretary', 'Open the secretary dashboard')
        );

        send_brevo_email(
            SECRETARY_EMAIL,
            'Clinic Secretary',
            "New appointment: {$a['patient']} with {$a['doctor']} on " . $a['when']->format('j M, g:i A'),
            $secretaryHtml
        );
    }
}

// ---------------------------------------------------------------------------
// Secretary confirmed the appointment -> email the patient
// ---------------------------------------------------------------------------
function notify_appointment_confirmed(PDO $pdo, int $appointmentId): void
{
    $a = mail_load_appointment($pdo, $appointmentId);
    if (!$a) {
        return;
    }

    $rows = [
        'Doctor' => mail_h($a['doctor']) . ' (' . mail_h($a['specialty']) . ')',
        'Service' => mail_h($a['service']),
        'Date' => mail_h($a['date_text']),
        'Time' => mail_h($a['time_text']),
        'Duration' => $a['duration'] . ' min',
        'Price' => mail_h($a['price_text']),
        'Status' => 'Confirmed',
    ];

    $html = mail_layout(
        'Your appointment is confirmed',
        "<p>Hello " . mail_h($a['p_first']) . ",</p>
         <p>Good news: the clinic has confirmed your appointment.
            Please arrive a few minutes before your appointment time.</p>"
        . mail_details_table($rows)
        . mail_button(rtrim(FRONTEND_URL, '/') . '/patient/appointments', 'View my appointments')
    );

    send_brevo_email($a['p_email'], $a['patient'], 'Your appointment is confirmed', $html);
}

// ---------------------------------------------------------------------------
// An appointment was cancelled.
//   $cancelledBy = 'patient'   -> email the secretary (and a copy to the patient)
//   $cancelledBy = 'secretary' -> email the patient
// ---------------------------------------------------------------------------
function notify_appointment_cancelled(PDO $pdo, int $appointmentId, string $cancelledBy): void
{
    $a = mail_load_appointment($pdo, $appointmentId);
    if (!$a) {
        return;
    }

    $reasonText = $a['cancellation_reason'] ? mail_h($a['cancellation_reason']) : '-';
    $baseUrl = rtrim(FRONTEND_URL, '/');

    if ($cancelledBy === 'patient') {
        // Notice to the secretary, so the freed time can be offered to someone else
        if (SECRETARY_EMAIL !== '' && filter_var(SECRETARY_EMAIL, FILTER_VALIDATE_EMAIL)) {
            $secretaryRows = [
                'Patient' => mail_h($a['patient']),
                'Phone' => $a['p_phone'] ? mail_h($a['p_phone']) : '-',
                'Doctor' => mail_h($a['doctor']),
                'Service' => mail_h($a['service']),
                'Date' => mail_h($a['date_text']),
                'Time' => mail_h($a['time_text']),
                'Reason' => $reasonText,
            ];

            $secretaryHtml = mail_layout(
                'Appointment cancelled by the patient',
                "<p>The patient cancelled this appointment. The time slot is free again.</p>"
                . mail_details_table($secretaryRows)
                . mail_button($baseUrl . '/secretary', 'Open the secretary dashboard')
            );

            send_brevo_email(
                SECRETARY_EMAIL,
                'Clinic Secretary',
                "Cancelled: {$a['patient']} with {$a['doctor']} on " . $a['when']->format('j M, g:i A'),
                $secretaryHtml
            );
        }

        // Short confirmation to the patient, so they know the cancellation worked
        $patientRows = [
            'Doctor' => mail_h($a['doctor']),
            'Date' => mail_h($a['date_text']),
            'Time' => mail_h($a['time_text']),
        ];

        $patientHtml = mail_layout(
            'Your appointment was cancelled',
            "<p>Hello " . mail_h($a['p_first']) . ",</p>
             <p>This confirms that your appointment has been cancelled.</p>"
            . mail_details_table($patientRows)
            . mail_button($baseUrl . '/book', 'Book a new appointment')
        );

        send_brevo_email($a['p_email'], $a['patient'], 'Your appointment was cancelled', $patientHtml);
        return;
    }

    // Cancelled by the clinic: tell the patient
    $rows = [
        'Doctor' => mail_h($a['doctor']),
        'Date' => mail_h($a['date_text']),
        'Time' => mail_h($a['time_text']),
        'Reason' => $reasonText,
    ];

    $html = mail_layout(
        'Your appointment was cancelled by the clinic',
        "<p>Hello " . mail_h($a['p_first']) . ",</p>
         <p>We are sorry, but the clinic had to cancel your appointment.
            You are welcome to book another time.</p>"
        . mail_details_table($rows)
        . mail_button($baseUrl . '/book', 'Book a new appointment')
    );

    send_brevo_email($a['p_email'], $a['patient'], 'Your appointment was cancelled by the clinic', $html);
}

// ---------------------------------------------------------------------------
// Reminder the day before. Returns true if the email was accepted by Brevo.
// ---------------------------------------------------------------------------
function notify_appointment_reminder(PDO $pdo, int $appointmentId): bool
{
    $a = mail_load_appointment($pdo, $appointmentId);
    if (!$a) {
        return false;
    }

    $rows = [
        'Doctor' => mail_h($a['doctor']) . ' (' . mail_h($a['specialty']) . ')',
        'Service' => mail_h($a['service']),
        'Date' => mail_h($a['date_text']),
        'Time' => mail_h($a['time_text']),
        'Duration' => $a['duration'] . ' min',
    ];

    $html = mail_layout(
        'Reminder: your appointment is tomorrow',
        "<p>Hello " . mail_h($a['p_first']) . ",</p>
         <p>This is a friendly reminder about your appointment tomorrow.
            If you can no longer make it, please cancel from your account so someone else can use the time.</p>"
        . mail_details_table($rows)
        . mail_button(rtrim(FRONTEND_URL, '/') . '/patient/appointments', 'Manage my appointment')
    );

    return send_brevo_email($a['p_email'], $a['patient'], 'Reminder: your appointment is tomorrow', $html);
}