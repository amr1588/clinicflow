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
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => [
            'accept: application/json',
            'api-key: ' . BREVO_API_KEY,
            'content-type: application/json',
        ],
        CURLOPT_TIMEOUT => 10,
    ]);

    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
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

// ---------------------------------------------------------------------------
// New appointment: one email to the patient, one to the secretary
// ---------------------------------------------------------------------------

/**
 * Call this right after an appointment is created. It loads the details itself,
 * so the caller only passes the appointment id.
 */
function notify_new_appointment(PDO $pdo, int $appointmentId): void
{
    $stmt = $pdo->prepare("
        SELECT a.appointment_date, a.appointment_time, a.duration_minutes, a.reason,
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
        return;
    }

    $when = new DateTimeImmutable($a['appointment_date'] . ' ' . $a['appointment_time']);
    $dateText = $when->format('l, j F Y');
    $timeText = $when->format('g:i A');
    $doctor = 'Dr. ' . $a['d_first'] . ' ' . $a['d_last'];
    $patient = $a['p_first'] . ' ' . $a['p_last'];
    $price = 'EGP ' . number_format((float) $a['price'], 0);
    $baseUrl = rtrim(FRONTEND_URL, '/');

    // ---- 1. Email to the patient ---------------------------------------
    $patientRows = [
        'Doctor' => mail_h($doctor) . ' (' . mail_h($a['specialty']) . ')',
        'Service' => mail_h($a['service_name']),
        'Date' => mail_h($dateText),
        'Time' => mail_h($timeText),
        'Duration' => (int) $a['duration_minutes'] . ' min',
        'Price' => mail_h($price),
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

    send_brevo_email($a['p_email'], $patient, 'Your appointment request was received', $patientHtml);

    // ---- 2. Email to the secretary --------------------------------------
    if (SECRETARY_EMAIL !== '' && filter_var(SECRETARY_EMAIL, FILTER_VALIDATE_EMAIL)) {
        $secretaryRows = [
            'Patient' => mail_h($patient),
            'Email' => mail_h($a['p_email']),
            'Phone' => $a['p_phone'] ? mail_h($a['p_phone']) : '-',
            'Doctor' => mail_h($doctor),
            'Service' => mail_h($a['service_name']),
            'Date' => mail_h($dateText),
            'Time' => mail_h($timeText),
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
            "New appointment: {$patient} with {$doctor} on " . $when->format('j M, g:i A'),
            $secretaryHtml
        );
    }
}