<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    respond(405, ['ok' => false, 'message' => 'Method not allowed.']);
}

session_start();
$userId = (int) ($_SESSION['user']['id'] ?? 0);
if ($userId < 1) {
    respond(401, ['ok' => false, 'message' => 'Please log in first.']);
}

try {
    require_once __DIR__ . '/../../config/database.php';
    $pdo = database_connection();
    $query = $pdo->prepare(
        'SELECT first_name, last_name, role FROM users
         WHERE id = :id AND is_active = 1 LIMIT 1'
    );
    $query->execute(['id' => $userId]);
    $user = $query->fetch();

    if (!$user) {
        respond(401, ['ok' => false, 'message' => 'The signed-in account is unavailable.']);
    }

    respond(200, [
        'ok' => true,
        'first_name' => $user['first_name'],
        'last_name' => $user['last_name'],
        'role' => $user['role'],
    ]);
} catch (Throwable $error) {
    error_log('SIRMS profile error: ' . $error->getMessage());
    respond(500, ['ok' => false, 'message' => 'Unable to load the signed-in profile.']);
}
