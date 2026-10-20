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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'message' => 'Method not allowed.']);
}

$data = $_POST;
if (!$data) {
    $decoded = json_decode((string) file_get_contents('php://input'), true);
    $data = is_array($decoded) ? $decoded : [];
}

$firstName = mb_strtoupper(trim((string) ($data['first_name'] ?? '')), 'UTF-8');
$lastName = mb_strtoupper(trim((string) ($data['last_name'] ?? '')), 'UTF-8');
$email = mb_strtoupper(trim((string) ($data['email'] ?? '')), 'UTF-8');
$username = mb_strtoupper(ltrim(trim((string) ($data['username'] ?? '')), '@'), 'UTF-8');
$password = (string) ($data['password'] ?? '');
$confirm = (string) ($data['confirm_password'] ?? '');

$errors = [];
if (mb_strlen($firstName) < 2 || mb_strlen($firstName) > 100) $errors[] = 'First name must be between 2 and 100 characters.';
if (mb_strlen($lastName) < 2 || mb_strlen($lastName) > 100) $errors[] = 'Last name must be between 2 and 100 characters.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) $errors[] = 'Enter a valid email address.';
if (!preg_match('/^[a-zA-Z0-9._-]{6,50}$/', $username)) $errors[] = 'Username must be 6–50 characters and use only letters, numbers, dots, underscores, or hyphens.';
if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters.';
if ($password !== $confirm) $errors[] = 'Passwords do not match.';
if ($errors) respond(422, ['ok' => false, 'message' => implode(' ', $errors)]);

try {
    require_once __DIR__ . '/../../config/database.php';
    $pdo = database_connection();
    $check = $pdo->prepare('SELECT username, email FROM users WHERE username = :username OR email = :email LIMIT 1');
    $check->execute(['username' => $username, 'email' => $email]);
    $existing = $check->fetch();
    if ($existing) {
        if (strcasecmp($existing['email'], $email) === 0) respond(409, ['ok' => false, 'message' => 'This email is already registered.']);
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
    respond(201, ['ok' => true, 'message' => 'Registration successful. You can now log in.']);
} catch (PDOException $error) {
    error_log('SIRMS registration error: ' . $error->getMessage());
    if ($error->getCode() === '23000') respond(409, ['ok' => false, 'message' => 'That username or email is already registered.']);
    respond(500, ['ok' => false, 'message' => 'Registration service is unavailable. Check the database setup and try again.']);
} catch (Throwable $error) {
    error_log('SIRMS registration error: ' . $error->getMessage());
    respond(500, ['ok' => false, 'message' => 'Registration service is unavailable. Check the database setup and try again.']);
}
