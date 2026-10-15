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
    $user = $auth->fetch();
    if (!$user || (int) $user['is_active'] !== 1 || strtoupper((string) $user['role']) !== 'ADMIN') {
        respond(403, ['ok' => false, 'message' => 'Administrator access is required.']);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $query = $pdo->query('SELECT id, sector_name, address, description, risk_tier, facility_lead, is_active, created_at, updated_at FROM plant_sectors ORDER BY id DESC');
        respond(200, ['ok' => true, 'sectors' => $query->fetchAll()]);
    }

    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['POST', 'PATCH', 'DELETE'], true)) {
        header('Allow: GET, POST, PATCH, DELETE');
        respond(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }
    $data = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($data)) respond(400, ['ok' => false, 'message' => 'Invalid request.']);

    if ($method === 'DELETE') {
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) respond(422, ['ok' => false, 'message' => 'Invalid plant sector.']);
        $delete = $pdo->prepare('DELETE FROM plant_sectors WHERE id = :id');
        $delete->execute(['id' => $id]);
        if (!$delete->rowCount()) respond(404, ['ok' => false, 'message' => 'Plant sector not found.']);
        respond(200, ['ok' => true, 'message' => 'Plant sector deleted.']);
    }

    if ($method === 'PATCH') {
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $id < 1) respond(422, ['ok' => false, 'message' => 'Invalid plant sector.']);
        if (($data['action'] ?? '') === 'status') {
            if (!array_key_exists('is_active', $data) || !in_array((int) $data['is_active'], [0, 1], true)) {
                respond(422, ['ok' => false, 'message' => 'Invalid plant sector status.']);
            }
            $update = $pdo->prepare('UPDATE plant_sectors SET is_active = :is_active, updated_by = :updated_by WHERE id = :id');
            $update->execute(['is_active' => (int) $data['is_active'], 'updated_by' => $userId, 'id' => $id]);
            if (!$update->rowCount()) {
                $exists = $pdo->prepare('SELECT id FROM plant_sectors WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetch()) respond(404, ['ok' => false, 'message' => 'Plant sector not found.']);
            }
            respond(200, ['ok' => true, 'message' => (int) $data['is_active'] === 1 ? 'Plant sector activated.' : 'Plant sector deactivated.']);
        }
        if (($data['action'] ?? '') !== 'update') respond(422, ['ok' => false, 'message' => 'Invalid plant sector action.']);
    }

    $name = mb_strtoupper(trim((string) ($data['sector_name'] ?? '')), 'UTF-8');
    $address = mb_strtoupper(trim((string) ($data['address'] ?? '')), 'UTF-8');
    $description = mb_strtoupper(trim((string) ($data['description'] ?? '')), 'UTF-8');
    $lead = mb_strtoupper(trim((string) ($data['facility_lead'] ?? '')), 'UTF-8');
    $risk = mb_strtoupper(trim((string) ($data['risk_tier'] ?? 'TIER 2')), 'UTF-8');
    $errors = [];
    if (mb_strlen($name) < 2 || mb_strlen($name) > 150) $errors[] = 'Sector name must be between 2 and 150 characters.';
    if (mb_strlen($address) < 5 || mb_strlen($address) > 255) $errors[] = 'Enter an address between 5 and 255 characters.';
    if (mb_strlen($description) > 5000) $errors[] = 'Description is too long.';
    if (mb_strlen($lead) > 150) $errors[] = 'Facility lead name is too long.';
    if (!in_array($risk, ['TIER 1', 'TIER 2', 'TIER 3'], true)) $errors[] = 'Select a valid risk tier.';
    if ($errors) respond(422, ['ok' => false, 'message' => implode(' ', $errors)]);

    if ($method === 'POST') {
        $insert = $pdo->prepare('INSERT INTO plant_sectors (sector_name, address, description, risk_tier, facility_lead, is_active, created_by, updated_by) VALUES (:sector_name, :address, :description, :risk_tier, :facility_lead, 1, :created_by, :updated_by)');
        $insert->execute([
            'sector_name' => $name,
            'address' => $address,
            'description' => $description !== '' ? $description : null,
            'risk_tier' => $risk,
            'facility_lead' => $lead !== '' ? $lead : null,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);
        respond(201, ['ok' => true, 'message' => 'Plant sector registered.', 'id' => (int) $pdo->lastInsertId()]);
    }

    $update = $pdo->prepare('UPDATE plant_sectors SET sector_name = :sector_name, address = :address, description = :description, risk_tier = :risk_tier, facility_lead = :facility_lead, updated_by = :updated_by WHERE id = :id');
    $update->execute([
        'sector_name' => $name,
        'address' => $address,
        'description' => $description !== '' ? $description : null,
        'risk_tier' => $risk,
        'facility_lead' => $lead !== '' ? $lead : null,
        'updated_by' => $userId,
        'id' => $id,
    ]);
    respond(200, ['ok' => true, 'message' => 'Plant sector updated.']);
} catch (PDOException $error) {
    error_log('SIRMS plant sector error: ' . $error->getMessage());
    if ($error->getCode() === '23000' && ($_SERVER['REQUEST_METHOD'] ?? '') === 'DELETE') {
        respond(409, ['ok' => false, 'message' => 'This sector is linked to existing records and cannot be deleted. Deactivate it to keep its history.']);
    }
    respond(500, ['ok' => false, 'message' => 'Unable to process plant sectors.']);
} catch (Throwable $error) {
    error_log('SIRMS plant sector error: ' . $error->getMessage());
    respond(500, ['ok' => false, 'message' => 'Unable to process plant sectors.']);
}
