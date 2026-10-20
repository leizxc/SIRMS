<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function officer_respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function officer_positive_ids(mixed $value): array
{
    if (!is_array($value)) return [];
    $ids = [];
    foreach ($value as $item) {
        $id = filter_var($item, FILTER_VALIDATE_INT);
        if ($id && $id > 0) $ids[] = (int) $id;
    }
    return array_values(array_unique($ids));
}

function officer_string(mixed $value, int $max): string
{
    return mb_substr(trim((string) $value), 0, $max, 'UTF-8');
}

function validate_officer_relations(PDO $pdo, int $roleId, ?int $sectorId, array $specialtyIds): void
{
    $role = $pdo->prepare('SELECT id FROM officer_roles WHERE id = :id AND is_active = 1');
    $role->execute(['id' => $roleId]);
    if (!$role->fetch()) officer_respond(422, ['ok' => false, 'message' => 'Choose an active officer role.']);

    if ($sectorId !== null) {
        $sector = $pdo->prepare('SELECT id FROM plant_sectors WHERE id = :id AND is_active = 1');
        $sector->execute(['id' => $sectorId]);
        if (!$sector->fetch()) officer_respond(422, ['ok' => false, 'message' => 'Choose an active plant sector.']);
    }

    if ($specialtyIds) {
        $placeholders = implode(',', array_fill(0, count($specialtyIds), '?'));
        $specialties = $pdo->prepare("SELECT id FROM officer_specialties WHERE is_active = 1 AND id IN ($placeholders)");
        $specialties->execute($specialtyIds);
        if (count($specialties->fetchAll()) !== count($specialtyIds)) {
            officer_respond(422, ['ok' => false, 'message' => 'One or more specialties are unavailable.']);
        }
    }
}

function save_officer_specialties(PDO $pdo, int $userId, array $specialtyIds): void
{
    $delete = $pdo->prepare('DELETE FROM officer_profile_specialties WHERE officer_user_id = :user_id');
    $delete->execute(['user_id' => $userId]);
    $insert = $pdo->prepare('INSERT INTO officer_profile_specialties (officer_user_id, specialty_id, is_primary) VALUES (:user_id, :specialty_id, :is_primary)');
    foreach ($specialtyIds as $index => $specialtyId) {
        $insert->execute(['user_id' => $userId, 'specialty_id' => $specialtyId, 'is_primary' => $index === 0 ? 1 : 0]);
    }
}

session_start();
$adminId = (int) ($_SESSION['user']['id'] ?? 0);
if ($adminId < 1) officer_respond(401, ['ok' => false, 'message' => 'Please log in first.']);

try {
    require_once __DIR__ . '/../../config/database.php';
    $pdo = database_connection();
    $auth = $pdo->prepare('SELECT role, is_active FROM users WHERE id = :id LIMIT 1');
    $auth->execute(['id' => $adminId]);
    $admin = $auth->fetch();
    if (!$admin || (int) $admin['is_active'] !== 1 || strtoupper((string) $admin['role']) !== 'ADMIN') {
        officer_respond(403, ['ok' => false, 'message' => 'Administrator access is required.']);
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') {
        $officers = $pdo->query("SELECT u.id, u.first_name, u.last_name, u.username, u.email, u.is_active,
                p.officer_role_id, r.role_name, p.plant_sector_id, s.sector_name,
                p.contact_number, p.created_at
            FROM users u
            INNER JOIN officer_profiles p ON p.user_id = u.id
            INNER JOIN officer_roles r ON r.id = p.officer_role_id
            LEFT JOIN plant_sectors s ON s.id = p.plant_sector_id
            WHERE UPPER(u.role) = 'OFFICER'
            ORDER BY u.id DESC")->fetchAll();
        $skills = $pdo->query('SELECT ops.officer_user_id, ops.specialty_id, ops.is_primary, os.specialty_name
            FROM officer_profile_specialties ops INNER JOIN officer_specialties os ON os.id = ops.specialty_id
            ORDER BY ops.is_primary DESC, os.specialty_name')->fetchAll();
        $skillsByOfficer = [];
        foreach ($skills as $skill) $skillsByOfficer[(int) $skill['officer_user_id']][] = $skill;
        foreach ($officers as &$officer) $officer['specialties'] = $skillsByOfficer[(int) $officer['id']] ?? [];
        unset($officer);
        officer_respond(200, [
            'ok' => true,
            'officers' => $officers,
            'roles' => $pdo->query('SELECT id, role_name FROM officer_roles WHERE is_active = 1 ORDER BY role_name')->fetchAll(),
            'specialties' => $pdo->query('SELECT id, specialty_name FROM officer_specialties WHERE is_active = 1 ORDER BY specialty_name')->fetchAll(),
            'sectors' => $pdo->query('SELECT id, sector_name FROM plant_sectors WHERE is_active = 1 ORDER BY sector_name')->fetchAll(),
        ]);
    }

    if (!in_array($method, ['POST', 'PATCH', 'DELETE'], true)) {
        header('Allow: GET, POST, PATCH, DELETE');
        officer_respond(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }

    $data = $method === 'POST' ? $_POST : json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($data)) officer_respond(400, ['ok' => false, 'message' => 'Invalid request.']);

    if ($method === 'PATCH' || $method === 'DELETE') {
        $officerId = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$officerId || $officerId < 1) officer_respond(422, ['ok' => false, 'message' => 'Invalid officer account.']);
        $find = $pdo->prepare("SELECT id FROM users WHERE id = :id AND UPPER(role) = 'OFFICER' LIMIT 1");
        $find->execute(['id' => $officerId]);
        if (!$find->fetch()) officer_respond(404, ['ok' => false, 'message' => 'Officer account not found.']);

        if ($method === 'DELETE') {
            if ((int) $officerId === $adminId) officer_respond(403, ['ok' => false, 'message' => 'You cannot delete your own account here.']);
            $delete = $pdo->prepare("DELETE FROM users WHERE id = :id AND UPPER(role) = 'OFFICER'");
            $delete->execute(['id' => $officerId]);
            officer_respond(200, ['ok' => true, 'message' => 'Officer account deleted.']);
        }

        if (($data['action'] ?? '') === 'status') {
            if (!array_key_exists('is_active', $data) || !in_array((int) $data['is_active'], [0, 1], true)) {
                officer_respond(422, ['ok' => false, 'message' => 'Invalid account status.']);
            }
            $update = $pdo->prepare("UPDATE users SET is_active = :is_active WHERE id = :id AND UPPER(role) = 'OFFICER'");
            $update->execute(['is_active' => (int) $data['is_active'], 'id' => $officerId]);
            officer_respond(200, ['ok' => true, 'message' => (int) $data['is_active'] === 1 ? 'Officer account unblocked.' : 'Officer account blocked.']);
        }
        if (($data['action'] ?? '') !== 'update') officer_respond(422, ['ok' => false, 'message' => 'Invalid officer account action.']);
    }

    $firstName = mb_strtoupper(officer_string($data['first_name'] ?? '', 100), 'UTF-8');
    $lastName = mb_strtoupper(officer_string($data['last_name'] ?? '', 100), 'UTF-8');
    $email = mb_strtoupper(officer_string($data['email'] ?? '', 254), 'UTF-8');
    $username = mb_strtoupper(ltrim(officer_string($data['username'] ?? '', 80), '@'), 'UTF-8');
    $contactNumber = officer_string($data['contact_number'] ?? '', 30);
    $password = (string) ($data['password'] ?? '');
    $confirm = (string) ($data['confirm_password'] ?? '');
    $roleId = filter_var($data['officer_role_id'] ?? null, FILTER_VALIDATE_INT);
    $sectorRaw = trim((string) ($data['plant_sector_id'] ?? ''));
    $sectorId = $sectorRaw === '' ? null : filter_var($sectorRaw, FILTER_VALIDATE_INT);
    $specialtyIds = officer_positive_ids($data['specialty_ids'] ?? []);

    $errors = [];
    if (mb_strlen($firstName) < 2) $errors[] = 'First name must be at least 2 characters.';
    if (mb_strlen($lastName) < 2) $errors[] = 'Last name must be at least 2 characters.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'Enter a valid work email address.';
    if (!preg_match('/^[a-zA-Z0-9._-]{6,50}$/', $username)) $errors[] = 'Username must be 6–50 characters and use letters, numbers, dots, underscores, or hyphens.';
    if (!$roleId || $roleId < 1) $errors[] = 'Choose an officer role.';
    if ($sectorRaw !== '' && (!$sectorId || $sectorId < 1)) $errors[] = 'Choose a valid plant sector.';
    if ($method === 'POST') {
        if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters.';
        if ($password !== $confirm) $errors[] = 'Passwords do not match.';
    }
    if ($errors) officer_respond(422, ['ok' => false, 'message' => implode(' ', $errors)]);

    $check = $pdo->prepare('SELECT id, username, email FROM users WHERE username = :username OR email = :email LIMIT 1');
    $check->execute(['username' => $username, 'email' => $email]);
    $existing = $check->fetch();
    if ($existing && ($method === 'POST' || (int) $existing['id'] !== (int) $data['id'])) {
        if (strcasecmp((string) $existing['email'], $email) === 0) officer_respond(409, ['ok' => false, 'message' => 'This email is already used by another account.']);
        officer_respond(409, ['ok' => false, 'message' => 'This username is already taken.']);
    }

    validate_officer_relations($pdo, (int) $roleId, $sectorId === false ? null : $sectorId, $specialtyIds);
    $pdo->beginTransaction();
    try {
        if ($method === 'POST') {
            $insert = $pdo->prepare("INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active) VALUES (:username, :email, :password_hash, :first_name, :last_name, 'OFFICER', 1)");
            $insert->execute(['username' => $username, 'email' => $email, 'password_hash' => password_hash($password, PASSWORD_DEFAULT), 'first_name' => $firstName, 'last_name' => $lastName]);
            $officerId = (int) $pdo->lastInsertId();
            $profile = $pdo->prepare('INSERT INTO officer_profiles (user_id, officer_role_id, plant_sector_id, contact_number, created_by, updated_by) VALUES (:user_id, :role_id, :sector_id, :contact_number, :created_by, :updated_by)');
            $profile->execute(['user_id' => $officerId, 'role_id' => $roleId, 'sector_id' => $sectorId === false ? null : $sectorId, 'contact_number' => $contactNumber === '' ? null : $contactNumber, 'created_by' => $adminId, 'updated_by' => $adminId]);
            save_officer_specialties($pdo, $officerId, $specialtyIds);
            $pdo->commit();
            officer_respond(201, ['ok' => true, 'message' => 'Officer account created successfully.']);
        }

        $officerId = (int) $data['id'];
        $updateUser = $pdo->prepare("UPDATE users SET first_name = :first_name, last_name = :last_name, username = :username, email = :email WHERE id = :id AND UPPER(role) = 'OFFICER'");
        $updateUser->execute(['first_name' => $firstName, 'last_name' => $lastName, 'username' => $username, 'email' => $email, 'id' => $officerId]);
        $updateProfile = $pdo->prepare('UPDATE officer_profiles SET officer_role_id = :role_id, plant_sector_id = :sector_id, contact_number = :contact_number, updated_by = :updated_by WHERE user_id = :user_id');
        $updateProfile->execute(['role_id' => $roleId, 'sector_id' => $sectorId === false ? null : $sectorId, 'contact_number' => $contactNumber === '' ? null : $contactNumber, 'updated_by' => $adminId, 'user_id' => $officerId]);
        save_officer_specialties($pdo, $officerId, $specialtyIds);
        $pdo->commit();
        officer_respond(200, ['ok' => true, 'message' => 'Officer account updated.']);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
} catch (PDOException $error) {
    error_log('SIRMS officer account error: ' . $error->getMessage());
    if ($error->getCode() === '23000') officer_respond(409, ['ok' => false, 'message' => 'That username or email is already in use, or the account is linked to existing records.']);
    officer_respond(500, ['ok' => false, 'message' => 'Unable to process officer accounts.']);
} catch (Throwable $error) {
    error_log('SIRMS officer account error: ' . $error->getMessage());
    officer_respond(500, ['ok' => false, 'message' => 'Unable to process officer accounts.']);
}
