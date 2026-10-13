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

session_start();
$userId = (int) ($_SESSION['user']['id'] ?? 0);
if ($userId < 1) respond(401, ['ok' => false, 'message' => 'Please log in first.']);

try {
    require_once __DIR__ . '/../../config/database.php';
    $pdo = database_connection();
    $auth = $pdo->prepare('SELECT role, is_active FROM users WHERE id = :id LIMIT 1');
    $auth->execute(['id' => $userId]);
    $admin = $auth->fetch();
    if (!$admin || (int) $admin['is_active'] !== 1 || strtoupper((string) $admin['role']) !== 'ADMIN') {
        respond(403, ['ok' => false, 'message' => 'Administrator access is required.']);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $query = $pdo->query("SELECT id, first_name, last_name, username, email, is_active FROM users WHERE UPPER(role) IN ('USER', 'USERS', 'REPORTER') ORDER BY id DESC");
        respond(200, ['ok' => true, 'reporters' => $query->fetchAll()]);
    }
    if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PATCH', 'DELETE'], true)) {
        header('Allow: GET, POST, PATCH, DELETE');
        respond(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'PATCH' || $_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $data = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($data)) respond(400, ['ok' => false, 'message' => 'Invalid request.']);
        $reporterId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$reporterId || $reporterId < 1) respond(422, ['ok' => false, 'message' => 'Invalid reporter account.']);
        $target = $pdo->prepare("SELECT id FROM users WHERE id = :id AND UPPER(role) IN ('USER', 'USERS', 'REPORTER') LIMIT 1");
        $target->execute(['id' => $reporterId]);
        if (!$target->fetch()) respond(404, ['ok' => false, 'message' => 'Reporter account not found.']);

        if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            if ($reporterId === $userId) respond(403, ['ok' => false, 'message' => 'You cannot delete your own account here.']);
            $delete = $pdo->prepare("DELETE FROM users WHERE id = :id AND UPPER(role) IN ('USER', 'USERS', 'REPORTER')");
            $delete->execute(['id' => $reporterId]);
            respond(200, ['ok' => true, 'message' => 'Reporter account deleted.']);
        }

        if (($data['action'] ?? '') === 'status') {
            if (!array_key_exists('is_active', $data) || !in_array((int) $data['is_active'], [0, 1], true)) {
                respond(422, ['ok' => false, 'message' => 'Invalid account status.']);
            }
            $update = $pdo->prepare("UPDATE users SET is_active = :is_active WHERE id = :id AND UPPER(role) IN ('USER', 'USERS', 'REPORTER')");
            $update->execute(['is_active' => (int) $data['is_active'], 'id' => $reporterId]);
            respond(200, ['ok' => true, 'message' => (int) $data['is_active'] === 1 ? 'Reporter account unblocked.' : 'Reporter account blocked.']);
        }

        if (($data['action'] ?? '') !== 'update') respond(422, ['ok' => false, 'message' => 'Invalid reporter account action.']);
        $firstName = mb_strtoupper(trim((string) ($data['first_name'] ?? '')), 'UTF-8');
        $lastName = mb_strtoupper(trim((string) ($data['last_name'] ?? '')), 'UTF-8');
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $username = ltrim(trim((string) ($data['username'] ?? '')), '@');
        $errors = [];
        if (mb_strlen($firstName) < 2 || mb_strlen($firstName) > 100) $errors[] = 'First name must be between 2 and 100 characters.';
        if (mb_strlen($lastName) < 2 || mb_strlen($lastName) > 100) $errors[] = 'Last name must be between 2 and 100 characters.';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) $errors[] = 'Enter a valid email address.';
        if (!preg_match('/^[a-zA-Z0-9._-]{3,50}$/', $username)) $errors[] = 'Username must be 3–50 characters and use only letters, numbers, dots, underscores, or hyphens.';
        if ($errors) respond(422, ['ok' => false, 'message' => implode(' ', $errors)]);

        $check = $pdo->prepare('SELECT username, email FROM users WHERE id <> :id AND (username = :username OR email = :email) LIMIT 1');
        $check->execute(['id' => $reporterId, 'username' => $username, 'email' => $email]);
        $existing = $check->fetch();
        if ($existing) {
            if (strcasecmp((string) $existing['email'], $email) === 0) respond(409, ['ok' => false, 'message' => 'This email is already used by another account.']);
            respond(409, ['ok' => false, 'message' => 'This username is already taken.']);
        }
        $update = $pdo->prepare("UPDATE users SET first_name = :first_name, last_name = :last_name, username = :username, email = :email WHERE id = :id AND UPPER(role) IN ('USER', 'USERS', 'REPORTER')");
        $update->execute(['first_name' => $firstName, 'last_name' => $lastName, 'username' => $username, 'email' => $email, 'id' => $reporterId]);
        respond(200, ['ok' => true, 'message' => 'Reporter account updated.']);
    }

    $data = $_POST;
    $firstName = mb_strtoupper(trim((string) ($data['first_name'] ?? '')), 'UTF-8');
    $lastName = mb_strtoupper(trim((string) ($data['last_name'] ?? '')), 'UTF-8');
    $email = strtolower(trim((string) ($data['email'] ?? '')));
    $username = ltrim(trim((string) ($data['username'] ?? '')), '@');
    $password = (string) ($data['password'] ?? '');
    $confirm = (string) ($data['confirm_password'] ?? '');

    $errors = [];
    if (mb_strlen($firstName) < 2 || mb_strlen($firstName) > 100) $errors[] = 'First name must be between 2 and 100 characters.';
    if (mb_strlen($lastName) < 2 || mb_strlen($lastName) > 100) $errors[] = 'Last name must be between 2 and 100 characters.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) $errors[] = 'Enter a valid email address.';
    if (!preg_match('/^[a-zA-Z0-9._-]{3,50}$/', $username)) $errors[] = 'Username must be 3–50 characters and use only letters, numbers, dots, underscores, or hyphens.';
    if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters.';
    if ($password !== $confirm) $errors[] = 'Passwords do not match.';
    if ($errors) respond(422, ['ok' => false, 'message' => implode(' ', $errors)]);

    $check = $pdo->prepare('SELECT username, email FROM users WHERE username = :username OR email = :email LIMIT 1');
    $check->execute(['username' => $username, 'email' => $email]);
    $existing = $check->fetch();
    if ($existing) {
        if (strcasecmp((string) $existing['email'], $email) === 0) respond(409, ['ok' => false, 'message' => 'This email is already registered.']);
        respond(409, ['ok' => false, 'message' => 'This username is already taken.']);
    }
    $insert = $pdo->prepare('INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active) VALUES (:username, :email, :password_hash, :first_name, :last_name, :role, 1)');
    $insert->execute([
        'username' => $username,
        'email' => $email,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'first_name' => $firstName,
        'last_name' => $lastName,
        'role' => 'USERS',
    ]);
    respond(201, ['ok' => true, 'message' => 'Reporter account created successfully.']);
} catch (PDOException $error) {
    error_log('SIRMS reporter account error: ' . $error->getMessage());
    if ($error->getCode() === '23000') {
        if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            respond(409, ['ok' => false, 'message' => 'This account is linked to existing records and cannot be deleted. Block the account to prevent future access while keeping its history.']);
        }
        respond(409, ['ok' => false, 'message' => 'That username or email is already registered.']);
    }
    respond(500, ['ok' => false, 'message' => 'Unable to process reporter accounts.']);
} catch (Throwable $error) {
    error_log('SIRMS reporter account error: ' . $error->getMessage());
    respond(500, ['ok' => false, 'message' => 'Unable to process reporter accounts.']);
}
