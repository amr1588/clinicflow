<?php
declare(strict_types=1);

require __DIR__ . '/config/config.php';

$to = 'amr.ahmed2000145111@gmail.com';   // an inbox you can open

echo "API key loaded: " . (BREVO_API_KEY !== '' ? 'yes (' . strlen(BREVO_API_KEY) . ' chars, starts with ' . substr(BREVO_API_KEY, 0, 9) . ')' : 'NO, it is empty') . PHP_EOL;
echo "Sender: " . MAIL_FROM_EMAIL . PHP_EOL;
echo "curl available: " . (function_exists('curl_init') ? 'yes' : 'NO') . PHP_EOL . PHP_EOL;

if (!function_exists('curl_init')) {
    exit("Enable extension=curl in C:\\xampp\\php\\php.ini, then run this again.\n");
}

$ch = curl_init('https://api.brevo.com/v3/smtp/email');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode([
        'sender' => ['name' => 'ClinicFlow', 'email' => MAIL_FROM_EMAIL],
        'to' => [['email' => $to]],
        'subject' => 'ClinicFlow test',
        'htmlContent' => '<p>If you can read this, Brevo works.</p>',
    ]),
    CURLOPT_HTTPHEADER => [
        'accept: application/json',
        'api-key: ' . BREVO_API_KEY,
        'content-type: application/json',
    ],
    CURLOPT_TIMEOUT => 15,
]);

$response = curl_exec($ch);
echo "HTTP status: " . curl_getinfo($ch, CURLINFO_HTTP_CODE) . PHP_EOL;
echo "curl error: " . (curl_error($ch) ?: 'none') . PHP_EOL;
echo "Brevo says: " . $response . PHP_EOL;
curl_close($ch);