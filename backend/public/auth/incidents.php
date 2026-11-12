<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function incident_respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function incident_input(string $key, int $maxLength): string
{
    $value = trim((string) ($_POST[$key] ?? ''));
    return mb_substr($value, 0, $maxLength, 'UTF-8');
}

session_start();
$userId = (int) ($_SESSION['user']['id'] ?? 0);
if ($userId < 1) incident_respond(401, ['ok' => false, 'message' => 'Please log in first.']);

try {
    require_once __DIR__ . '/../../config/database.php';
    $pdo = database_connection();
    $accountQuery = $pdo->prepare('SELECT id, role FROM users WHERE id = :id AND is_active = 1 LIMIT 1');
    $accountQuery->execute(['id' => $userId]);
    $account = $accountQuery->fetch();
    if (!$account) incident_respond(401, ['ok' => false, 'message' => 'The signed-in account is unavailable.']);

    $role = strtoupper((string) $account['role']);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET' && isset($_GET['evidence'])) {
        if (!in_array($role, ['ADMIN', 'USER', 'USERS', 'REPORTER', 'OFFICER'], true)) {
            incident_respond(403, ['ok' => false, 'message' => 'You cannot view incident evidence.']);
        }
        $evidenceId = filter_var($_GET['evidence'], FILTER_VALIDATE_INT);
        if (!$evidenceId || $evidenceId < 1) incident_respond(404, ['ok' => false, 'message' => 'Evidence file not found.']);
        $evidenceQuery = $pdo->prepare('SELECT e.original_name, e.storage_name, e.mime_type
            FROM incident_evidence e INNER JOIN incidents i ON i.id = e.incident_id
            WHERE e.id = :evidence_id AND (:is_admin = 1 OR i.reporter_id = :reporter_id OR EXISTS (
                SELECT 1 FROM incident_assignments a WHERE a.incident_id = i.id AND a.officer_user_id = :officer_id
            )) LIMIT 1');
        $evidenceQuery->execute(['evidence_id' => $evidenceId, 'is_admin' => $role === 'ADMIN' ? 1 : 0, 'reporter_id' => $userId, 'officer_id' => $role === 'OFFICER' ? $userId : 0]);
        $evidence = $evidenceQuery->fetch();
        if (!$evidence) incident_respond(404, ['ok' => false, 'message' => 'Evidence file not found.']);
        $filePath = dirname(__DIR__, 2) . '/storage/incident-evidence/' . basename((string) $evidence['storage_name']);
        if (!is_file($filePath)) incident_respond(404, ['ok' => false, 'message' => 'Evidence file is unavailable.']);
        header('Content-Type: ' . $evidence['mime_type']);
        $inline = ($_GET['inline'] ?? '') === '1' && in_array($evidence['mime_type'], ['image/jpeg', 'image/png', 'video/mp4', 'audio/mpeg'], true);
        header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename*=UTF-8\'\'' . rawurlencode((string) $evidence['original_name']));
        header('X-Content-Type-Options: nosniff');
        header('Content-Length: ' . (string) filesize($filePath));
        readfile($filePath);
        exit;
    }
    if ($method === 'GET') {
        if ($role !== 'ADMIN' && !in_array($role, ['USER', 'USERS', 'REPORTER', 'OFFICER'], true)) {
            incident_respond(403, ['ok' => false, 'message' => 'You cannot view incident reports.']);
        }
        if ($role === 'ADMIN') {
            $query = $pdo->query("SELECT i.id, i.incident_code, i.category, s.sector_name AS location, i.plant_sector_id, i.occurred_at,
                    i.severity, i.description, i.witnesses, i.status, i.created_at,
                    u.first_name, u.last_name, a.officer_user_id, CONCAT(o.first_name, ' ', o.last_name) AS assigned_officer
                FROM incidents i INNER JOIN users u ON u.id = i.reporter_id
                INNER JOIN plant_sectors s ON s.id = i.plant_sector_id
                LEFT JOIN incident_assignments a ON a.incident_id = i.id
                LEFT JOIN users o ON o.id = a.officer_user_id
                ORDER BY i.created_at DESC, i.id DESC");
        } elseif ($role === 'OFFICER') {
            $query = $pdo->prepare("SELECT i.id, i.incident_code, i.category, s.sector_name AS location, i.plant_sector_id, i.occurred_at,
                    i.severity, i.description, i.witnesses, i.status, i.created_at,
                    u.first_name, u.last_name, a.officer_user_id, CONCAT(o.first_name, ' ', o.last_name) AS assigned_officer
                FROM incidents i INNER JOIN users u ON u.id = i.reporter_id
                INNER JOIN plant_sectors s ON s.id = i.plant_sector_id
                INNER JOIN incident_assignments a ON a.incident_id = i.id AND a.officer_user_id = :officer_id
                INNER JOIN users o ON o.id = a.officer_user_id
                ORDER BY i.created_at DESC, i.id DESC");
            $query->execute(['officer_id' => $userId]);
        } else {
            $query = $pdo->prepare("SELECT i.id, i.incident_code, i.category, s.sector_name AS location, i.plant_sector_id, i.occurred_at,
                    i.severity, i.description, i.witnesses, i.status, i.created_at,
                    u.first_name, u.last_name, CONCAT(o.first_name, ' ', o.last_name) AS assigned_officer
                FROM incidents i INNER JOIN users u ON u.id = i.reporter_id
                INNER JOIN plant_sectors s ON s.id = i.plant_sector_id
                LEFT JOIN incident_assignments a ON a.incident_id = i.id
                LEFT JOIN users o ON o.id = a.officer_user_id
                WHERE i.reporter_id = :reporter_id
                ORDER BY i.created_at DESC, i.id DESC");
            $query->execute(['reporter_id' => $userId]);
        }
        $incidents = $query->fetchAll();
        if ($role === 'ADMIN') {
            $evidenceQuery = $pdo->query('SELECT e.id, e.incident_id, e.original_name, e.mime_type FROM incident_evidence e ORDER BY e.id');
        } elseif ($role === 'OFFICER') {
            $evidenceQuery = $pdo->prepare('SELECT e.id, e.incident_id, e.original_name, e.mime_type
                FROM incident_evidence e INNER JOIN incident_assignments a ON a.incident_id = e.incident_id
                WHERE a.officer_user_id = :officer_id ORDER BY e.id');
            $evidenceQuery->execute(['officer_id' => $userId]);
        } else {
            $evidenceQuery = $pdo->prepare('SELECT e.id, e.incident_id, e.original_name, e.mime_type FROM incident_evidence e INNER JOIN incidents i ON i.id = e.incident_id WHERE i.reporter_id = :reporter_id ORDER BY e.id');
            $evidenceQuery->execute(['reporter_id' => $userId]);
        }
        $evidenceByIncident = [];
        foreach ($evidenceQuery->fetchAll() as $item) {
            $evidenceByIncident[(int) $item['incident_id']][] = [
                'id' => (int) $item['id'],
                'name' => $item['original_name'],
                'mime_type' => $item['mime_type'],
            ];
        }
        foreach ($incidents as &$incident) {
            $incident['evidence'] = $evidenceByIncident[(int) $incident['id']] ?? [];
        }
        unset($incident);
        if ($role === 'OFFICER') incident_respond(200, ['ok' => true, 'incidents' => $incidents]);
        $sectors = $pdo->query('SELECT id, sector_name FROM plant_sectors WHERE is_active = 1 ORDER BY sector_name')->fetchAll();
        incident_respond(200, ['ok' => true, 'incidents' => $incidents, 'sectors' => $sectors]);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        incident_respond(405, ['ok' => false, 'message' => 'Method not allowed.']);
    }
    if ($role === 'ADMIN') {
        $data = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($data) || ($data['action'] ?? '') !== 'assign') {
            incident_respond(400, ['ok' => false, 'message' => 'Invalid assignment request.']);
        }
        $incidentId = filter_var($data['incident_id'] ?? null, FILTER_VALIDATE_INT);
        $officerId = filter_var($data['officer_id'] ?? null, FILTER_VALIDATE_INT);
        if (!$incidentId || $incidentId < 1) incident_respond(422, ['ok' => false, 'message' => 'Choose a valid incident.']);
        if (!$officerId || $officerId < 1) incident_respond(422, ['ok' => false, 'message' => 'Choose an officer to assign.']);
        $incidentCheck = $pdo->prepare('SELECT id FROM incidents WHERE id = :id LIMIT 1');
        $incidentCheck->execute(['id' => $incidentId]);
        if (!$incidentCheck->fetch()) incident_respond(404, ['ok' => false, 'message' => 'Incident report not found.']);
        $officerCheck = $pdo->prepare("SELECT u.id FROM users u INNER JOIN officer_profiles p ON p.user_id = u.id WHERE u.id = :id AND UPPER(u.role) = 'OFFICER' AND u.is_active = 1 LIMIT 1");
        $officerCheck->execute(['id' => $officerId]);
        if (!$officerCheck->fetch()) incident_respond(422, ['ok' => false, 'message' => 'Choose an active officer account.']);
        $assign = $pdo->prepare('INSERT INTO incident_assignments (incident_id, officer_user_id, assigned_by)
            VALUES (:incident_id, :officer_user_id, :assigned_by)
            ON DUPLICATE KEY UPDATE officer_user_id = VALUES(officer_user_id), assigned_by = VALUES(assigned_by), assigned_at = CURRENT_TIMESTAMP');
        $assign->execute(['incident_id' => $incidentId, 'officer_user_id' => $officerId, 'assigned_by' => $userId]);
        incident_respond(200, ['ok' => true, 'message' => 'Officer assigned to the incident.']);
    }
    if ($role === 'OFFICER') {
        $data = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($data) || ($data['action'] ?? '') !== 'update_status') {
            incident_respond(400, ['ok' => false, 'message' => 'Invalid incident update request.']);
        }
        $incidentId = filter_var($data['incident_id'] ?? null, FILTER_VALIDATE_INT);
        $status = trim((string) ($data['status'] ?? ''));
        if (!$incidentId || $incidentId < 1) incident_respond(422, ['ok' => false, 'message' => 'Choose a valid incident.']);
        if (!in_array($status, ['Under Review', 'In Progress', 'Resolved'], true)) {
            incident_respond(422, ['ok' => false, 'message' => 'Choose a valid incident status.']);
        }
        $update = $pdo->prepare("UPDATE incidents i INNER JOIN incident_assignments a ON a.incident_id = i.id
            SET i.status = :status WHERE i.id = :incident_id AND a.officer_user_id = :officer_id");
        $update->execute(['status' => $status, 'incident_id' => $incidentId, 'officer_id' => $userId]);
        if ($update->rowCount() < 1) {
            $check = $pdo->prepare('SELECT i.status FROM incidents i INNER JOIN incident_assignments a ON a.incident_id = i.id WHERE i.id = :incident_id AND a.officer_user_id = :officer_id LIMIT 1');
            $check->execute(['incident_id' => $incidentId, 'officer_id' => $userId]);
            $current = $check->fetch();
            if (!$current) incident_respond(404, ['ok' => false, 'message' => 'This incident is not assigned to your account.']);
            if ($current['status'] !== $status) incident_respond(500, ['ok' => false, 'message' => 'Unable to update the incident status.']);
        }
        incident_respond(200, ['ok' => true, 'message' => 'Incident status updated.']);
    }
    if (!in_array($role, ['USER', 'USERS', 'REPORTER'], true)) {
        incident_respond(403, ['ok' => false, 'message' => 'Only reporter accounts can submit incident reports.']);
    }

    $category = incident_input('category', 100);
    $sectorId = filter_var($_POST['plant_sector_id'] ?? null, FILTER_VALIDATE_INT);
    $occurredRaw = trim((string) ($_POST['occurred_at'] ?? ''));
    $occurredAt = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $occurredRaw);
    $severity = incident_input('severity', 20);
    $description = incident_input('description', 1000);
    $witnesses = incident_input('witnesses', 500);
    $categories = [
        'Equipment Malfunction',
        'Chemical / Hazardous Spill',
        'Slip, Trip & Fall Hazard',
        'Fire & Electrical Safety',
        'PPE Non-Compliance',
        'Structural Damage / Exit Block',
    ];
    $severities = ['Low', 'Moderate', 'High', 'Critical'];
    if (!in_array($category, $categories, true)) incident_respond(422, ['ok' => false, 'message' => 'Choose a valid incident category.']);
    if (!$sectorId || $sectorId < 1) incident_respond(422, ['ok' => false, 'message' => 'Choose a plant sector.']);
    $sectorQuery = $pdo->prepare('SELECT id FROM plant_sectors WHERE id = :id AND is_active = 1 LIMIT 1');
    $sectorQuery->execute(['id' => $sectorId]);
    if (!$sectorQuery->fetch()) incident_respond(422, ['ok' => false, 'message' => 'Choose an active plant sector.']);
    if (!$occurredAt || $occurredAt->format('Y-m-d\TH:i') !== $occurredRaw) incident_respond(422, ['ok' => false, 'message' => 'Enter a valid incident date and time.']);
    if (!in_array($severity, $severities, true)) incident_respond(422, ['ok' => false, 'message' => 'Choose a valid severity level.']);
    if ($description === '') incident_respond(422, ['ok' => false, 'message' => 'Describe what happened.']);
    if (!isset($_POST['accuracy'])) incident_respond(422, ['ok' => false, 'message' => 'Confirm the report details before submitting.']);

    $files = [];
    if (isset($_FILES['evidence']) && is_array($_FILES['evidence']['name'] ?? null)) {
        $fileCount = count($_FILES['evidence']['name']);
        if ($fileCount > 5) incident_respond(422, ['ok' => false, 'message' => 'You can attach up to 5 evidence files.']);
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'video/mp4' => 'mp4', 'audio/mpeg' => 'mp3'];
        for ($index = 0; $index < $fileCount; $index++) {
            $error = (int) $_FILES['evidence']['error'][$index];
            if ($error === UPLOAD_ERR_NO_FILE) continue;
            if ($error !== UPLOAD_ERR_OK) incident_respond(422, ['ok' => false, 'message' => 'An evidence file could not be uploaded. Check the file size and try again.']);
            $tmpName = (string) $_FILES['evidence']['tmp_name'][$index];
            $size = (int) $_FILES['evidence']['size'][$index];
            $mime = $finfo->file($tmpName) ?: '';
            if ($size < 1 || $size > 50 * 1024 * 1024) incident_respond(422, ['ok' => false, 'message' => 'Each evidence file must not exceed 50 MB.']);
            if (!isset($allowed[$mime])) incident_respond(422, ['ok' => false, 'message' => 'Evidence must be a PNG, JPG, MP4, or MP3 file.']);
            $files[] = [
                'tmp_name' => $tmpName,
                'original_name' => mb_substr(basename((string) $_FILES['evidence']['name'][$index]), 0, 255, 'UTF-8'),
                'size' => $size,
                'mime' => $mime,
                'extension' => $allowed[$mime],
            ];
        }
    }

    $pdo->beginTransaction();
    $insert = $pdo->prepare('INSERT INTO incidents (reporter_id, plant_sector_id, category, occurred_at, severity, description, witnesses) VALUES (:reporter_id, :plant_sector_id, :category, :occurred_at, :severity, :description, :witnesses)');
    $insert->execute([
        'reporter_id' => $userId,
        'plant_sector_id' => $sectorId,
        'category' => $category,
        'occurred_at' => $occurredAt->format('Y-m-d H:i:s'),
        'severity' => $severity,
        'description' => $description,
        'witnesses' => $witnesses === '' ? null : $witnesses,
    ]);
    $incidentId = (int) $pdo->lastInsertId();
    $code = sprintf('SIR-%s-%06d', date('Y'), $incidentId);
    $codeUpdate = $pdo->prepare('UPDATE incidents SET incident_code = :incident_code WHERE id = :id');
    $codeUpdate->execute(['incident_code' => $code, 'id' => $incidentId]);

    $storageDirectory = dirname(__DIR__, 2) . '/storage/incident-evidence';
    if ($files && !is_dir($storageDirectory) && !mkdir($storageDirectory, 0750, true) && !is_dir($storageDirectory)) {
        throw new RuntimeException('Could not prepare evidence storage.');
    }
    $evidenceInsert = $pdo->prepare('INSERT INTO incident_evidence (incident_id, original_name, storage_name, mime_type, file_size) VALUES (:incident_id, :original_name, :storage_name, :mime_type, :file_size)');
    $storedFiles = [];
    foreach ($files as $file) {
        $storageName = bin2hex(random_bytes(20)) . '.' . $file['extension'];
        if (!move_uploaded_file($file['tmp_name'], $storageDirectory . '/' . $storageName)) {
            throw new RuntimeException('Could not store an evidence file.');
        }
        $storedFiles[] = $storageDirectory . '/' . $storageName;
        $evidenceInsert->execute([
            'incident_id' => $incidentId,
            'original_name' => $file['original_name'],
            'storage_name' => $storageName,
            'mime_type' => $file['mime'],
            'file_size' => $file['size'],
        ]);
    }
    $pdo->commit();
    incident_respond(201, ['ok' => true, 'message' => 'Incident report submitted successfully.', 'incident_code' => $code]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    foreach ($storedFiles ?? [] as $storedFile) if (is_file($storedFile)) unlink($storedFile);
    error_log('SIRMS incident report error: ' . $error->getMessage());
    incident_respond(500, ['ok' => false, 'message' => 'Unable to submit the incident report right now. Please try again.']);
}
