<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'message' => 'Method not allowed.']);
}

$payload = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($payload)) {
    respond(400, ['ok' => false, 'message' => 'Invalid request.']);
}

$identifier = trim((string) ($payload['username'] ?? ''));
$password = (string) ($payload['password'] ?? '');
$remember = filter_var($payload['remember'] ?? false, FILTER_VALIDATE_BOOLEAN);

if ($identifier === '' || $password === '' || strlen($identifier) > 254) {
    respond(422, ['ok' => false, 'message' => 'Enter your username or email and password.']);
}

try {
    require_once __DIR__ . '/../../config/database.php';
    $pdo = database_connection();
    $query = $pdo->prepare(
        'SELECT id, username, email, password_hash FROM users
         WHERE is_active = 1 AND (username = :username OR email = :email)
         LIMIT 1'
    );
    $query->execute(['username' => $identifier, 'email' => $identifier]);
    $user = $query->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        respond(401, ['ok' => false, 'message' => 'The username/email or password is incorrect.']);
    }

    $lifetime = $remember ? 60 * 60 * 24 * 30 : 0;
    if ($remember) {
        ini_set('session.gc_maxlifetime', (string) $lifetime);
    }
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => '/',
        'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id' => (int) $user['id'],
        'username' => $user['username'],
        'email' => $user['email'],
    ];

    respond(200, ['ok' => true, 'message' => 'Login successful. Your session is now active.']);
} catch (Throwable $error) {
    error_log('SIRMS login error: ' . $error->getMessage());
    respond(500, ['ok' => false, 'message' => 'Unable to connect to the login service. Check the database setup and try again.']);
}
