<?php
declare(strict_types=1);

namespace App\controllers;

use App\controllers\Controller;
use App\core\Database;
use App\core\R2StorageHelper;
use Exception;

class ApplicantController extends Controller {
    private const MAX_DOCUMENTS_PER_APPLICANT = 7;
    private const MAX_DOCUMENT_SIZE_BYTES = 52428800; // 50 MB
    private const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf'];

    /**
     * GET: /api/applicants
     * Retrieves a paginated list of applicants.
     */
    public function index(): void {
        $this->checkPermission(['Admin', 'Editor']);

        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $search = $_GET['search'] ?? null;
        $offset = ($page - 1) * $limit;

        $baseQuery = "FROM applicants";
        $params = [];

        if ($search) {
            $baseQuery .= " WHERE (FirstName LIKE ? OR LastName LIKE ? OR ContactNo LIKE ? OR Gender LIKE ? )";
            $searchTerm = "%{$search}%";
            $params = [$searchTerm, $searchTerm, $searchTerm, $searchTerm];
        }

        $totalResult = Database::fetch("SELECT COUNT(*) as cnt " . $baseQuery, $params);
        $total = $totalResult['cnt'] ?? 0;

        $query = "SELECT id, FirstName, LastName, MiddleName, Address, ContactNo, Gender " . $baseQuery . " ORDER BY LastName ASC, FirstName ASC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        $applicants = Database::fetchAll($query, $params);

        $this->response(true, 'Applicants retrieved successfully', [
            'applicants' => $applicants,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $limit,
                'total' => (int)$total,
                'total_pages' => (int)ceil((int)$total / $limit)
            ]
        ]);
    }

    /**
     * GET: /api/applicants/{id}
     * Retrieves a single applicant.
     */
    public function show(?string $id = null): void {
        $this->checkPermission(['Admin', 'Editor']);

        if (!$id) {
            $this->response(false, 'Applicant ID is required', [], 400);
            return;
        }

        $applicant = $this->getApplicant((int)$id);

        if (!$applicant) {
            $this->response(false, 'Applicant not found', [], 404);
            return;
        }

        $franchises = Database::fetchAll("
            SELECT 
                f.*,
                m.Name as MakeName
            FROM franchises f
            LEFT JOIN makes m ON f.MakeID = m.id
            WHERE f.ApplicantID = ?
            ORDER BY f.DateIssued DESC
        ", [$id]);

        $applicant['franchises'] = $franchises;
        $documents = $this->getApplicantDocuments((int)$id);
        $applicant['documents'] = $documents;
        $applicant['Documents'] = $documents;

        $this->response(true, 'Applicant and their franchises retrieved successfully', ['applicant' => $applicant]);
    }

    /**
     * POST: /api/applicants
     * Creates a new applicant.
     */
    public function create(): void {
        $this->checkPermission(['Admin', 'Editor']);

        $data = $this->getJsonInput();

        $required = ['FirstName', 'LastName', 'Address', 'Gender'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                $this->response(false, "Field '{$field}' is required", [], 400);
                return;
            }
        }

        $normalizedGender = strtoupper(trim((string)($data['Gender'] ?? '')));
        if (!in_array($normalizedGender, ['M', 'F'], true)) {
            $this->response(false, "Field 'Gender' must be either 'M' or 'F'", [], 400);
            return;
        }

        $authUserID = $this->getAuthenticatedUser();

        try {
            $id = Database::insert('applicants', [
                'FirstName' => $data['FirstName'],
                'LastName' => $data['LastName'],
                'MiddleName' => $data['MiddleName'] ?? null,
                'Address' => $data['Address'],
                'ContactNo' => $data['ContactNo'] ?? null,
                'Gender' => $normalizedGender,
                'CreatedBy' => $authUserID,
                'UpdatedBy' => $authUserID
            ]);

            $applicant = $this->getApplicant((int)$id);
            $documents = $this->getApplicantDocuments((int)$id);
            $applicant['documents'] = $documents;
            $applicant['Documents'] = $documents;

            $this->response(true, 'Applicant created successfully', ['applicant' => $applicant], 201);
        } catch (Exception $e) {
            error_log('Applicant creation error: ' . $e->getMessage());
            $this->response(false, 'Failed to create applicant', [], 500);
        }
    }

    /**
     * PUT: /api/applicants/{id}
     * Updates an applicant.
     */
    public function update(?string $id = null): void {
        $this->checkPermission(['Admin', 'Editor']);

        if (!$id) {
            $this->response(false, 'Applicant ID is required', [], 400);
            return;
        }

        $data = $this->getJsonInput();

        $existing = Database::fetch("SELECT * FROM applicants WHERE id = ?", [$id]);
        if (!$existing) {
            $this->response(false, 'Applicant not found', [], 404);
            return;
        }

        $authUserID = $this->getAuthenticatedUser();

        $updateData = [];
        if (array_key_exists('Gender', $data)) {
            $normalizedGender = strtoupper(trim((string)$data['Gender']));
            if (!in_array($normalizedGender, ['M', 'F'], true)) {
                $this->response(false, "Field 'Gender' must be either 'M' or 'F'", [], 400);
                return;
            }

            $data['Gender'] = $normalizedGender;
        }

        $allowedFields = ['FirstName', 'LastName', 'MiddleName', 'Address', 'ContactNo', 'Gender'];

        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updateData[$field] = $data[$field];
            }
        }

        if (empty($updateData)) {
            $applicant = $this->getApplicant((int)$id);
            $documents = $this->getApplicantDocuments((int)$id);
            $applicant['documents'] = $documents;
            $applicant['Documents'] = $documents;
            $this->response(true, 'No changes made to applicant', ['applicant' => $applicant]);
            return;
        }

        $updateData['UpdatedBy'] = $authUserID;

        try {
            Database::update('applicants', $updateData, 'id = :id', ['id' => $id]);

            $applicant = $this->getApplicant((int)$id);
            $documents = $this->getApplicantDocuments((int)$id);
            $applicant['documents'] = $documents;
            $applicant['Documents'] = $documents;

            $this->response(true, 'Applicant updated successfully', ['applicant' => $applicant]);
        } catch (Exception $e) {
            error_log('Applicant update error: ' . $e->getMessage());
            $this->response(false, 'Failed to update applicant', [], 500);
        }
    }

    /**
     * POST: /api/applicants/{id}/documents
     * Uploads applicant requirement documents (PDF only).
     */
    public function uploadDocuments(?string $id = null): void {
        $this->checkPermission(['Admin', 'Editor']);

        if (!$id) {
            $this->response(false, 'Applicant ID is required', [], 400);
            return;
        }

        $applicant = $this->getApplicant((int)$id);
        if (!$applicant) {
            $this->response(false, 'Applicant not found', [], 404);
            return;
        }

        $files = $this->normalizeUploadedFiles('documents');
        if (empty($files)) {
            $files = $this->normalizeUploadedFiles('files');
        }

        if (empty($files)) {
            $this->response(false, 'Please attach at least one PDF file.', [], 400);
            return;
        }

        if (count($files) > self::MAX_DOCUMENTS_PER_APPLICANT) {
            $this->response(false, 'You can upload a maximum of 7 PDF files at once.', [], 400);
            return;
        }

        $existingDocuments = $this->getApplicantDocuments((int)$id);
        if (count($existingDocuments) + count($files) > self::MAX_DOCUMENTS_PER_APPLICANT) {
            $remainingSlots = max(self::MAX_DOCUMENTS_PER_APPLICANT - count($existingDocuments), 0);
            $this->response(false, 'This applicant can only have up to 7 requirement PDFs. Remaining slots: ' . $remainingSlots . '.', [], 400);
            return;
        }

        $authUserID = $this->getAuthenticatedUser();
        $uploadedKeys = [];
        $createdIds = [];

        try {
            foreach ($files as $file) {
                $validationError = $this->validatePdfUpload($file);
                if ($validationError !== null) {
                    throw new Exception($validationError);
                }

                $uploadResult = R2StorageHelper::uploadFromRequest(
                    $file,
                    'applicant-requirements/' . (int)$id,
                    self::ALLOWED_DOCUMENT_MIME_TYPES,
                    self::MAX_DOCUMENT_SIZE_BYTES
                );

                if (!($uploadResult['success'] ?? false)) {
                    throw new Exception((string)($uploadResult['message'] ?? 'Failed to upload PDF document.'));
                }

                $uploadedKeys[] = (string)$uploadResult['file_path'];

                $createdIds[] = Database::insert('applicant_documents', [
                    'ApplicantID' => (int)$id,
                    'OriginalFileName' => (string)$file['name'],
                    'FilePath' => (string)$uploadResult['file_path'],
                    'FileSize' => (int)($uploadResult['file_size'] ?? $file['size'] ?? 0),
                    'MimeType' => 'application/pdf',
                    'CreatedBy' => $authUserID,
                    'UpdatedBy' => $authUserID,
                ]);
            }

            $documents = $this->getApplicantDocuments((int)$id);
            $this->response(true, 'Applicant documents uploaded successfully.', ['documents' => $documents], 201);
        } catch (Exception $e) {
            foreach ($createdIds as $createdId) {
                try {
                    Database::query('DELETE FROM applicant_documents WHERE id = ?', [$createdId]);
                } catch (Exception $rollbackException) {
                    error_log('Applicant document rollback DB error: ' . $rollbackException->getMessage());
                }
            }

            foreach ($uploadedKeys as $uploadedKey) {
                try {
                    R2StorageHelper::delete($uploadedKey);
                } catch (Exception $rollbackException) {
                    error_log('Applicant document rollback file error: ' . $rollbackException->getMessage());
                }
            }

            error_log('Applicant document upload error: ' . $e->getMessage());
            $this->response(false, $e->getMessage(), [], 500);
        }
    }

    /**
     * GET: /api/applicants/{id}/documents/{documentId}/stream
     * Streams a stored applicant PDF to the browser.
     */
    public function streamDocument(?string $id = null, ?string $documentId = null): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);

        if (!$id || !$documentId) {
            $this->response(false, 'Applicant ID and document ID are required.', [], 400);
            return;
        }

        $document = Database::fetch(
            'SELECT * FROM applicant_documents WHERE id = ? AND ApplicantID = ? LIMIT 1',
            [(int)$documentId, (int)$id]
        );

        if (!$document) {
            $this->response(false, 'Applicant document not found.', [], 404);
            return;
        }

        $filePath = (string)($document['FilePath'] ?? '');
        if ($filePath === '') {
            $this->response(false, 'Document file path is missing.', [], 404);
            return;
        }

        $fileName = (string)($document['OriginalFileName'] ?? ('applicant-document-' . $documentId . '.pdf'));
        R2StorageHelper::streamToBrowser($filePath, $fileName, 'application/pdf', true);
    }

    /**
     * DELETE: /api/applicants/{id}/documents/{documentId}
     * Deletes an applicant document record and file.
     */
    public function deleteDocument(?string $id = null, ?string $documentId = null): void {
        $this->checkPermission(['Admin', 'Editor']);

        if (!$id || !$documentId) {
            $this->response(false, 'Applicant ID and document ID are required.', [], 400);
            return;
        }

        $document = Database::fetch(
            'SELECT * FROM applicant_documents WHERE id = ? AND ApplicantID = ? LIMIT 1',
            [(int)$documentId, (int)$id]
        );

        if (!$document) {
            $this->response(false, 'Applicant document not found.', [], 404);
            return;
        }

        try {
            $fileDeleted = true;
            $filePath = (string)($document['FilePath'] ?? '');
            if ($filePath !== '') {
                $fileDeleted = R2StorageHelper::delete($filePath);
            }

            if (!$fileDeleted) {
                $this->response(false, 'Failed to delete the document file from storage.', [], 500);
                return;
            }

            Database::query('DELETE FROM applicant_documents WHERE id = ? AND ApplicantID = ?', [(int)$documentId, (int)$id]);

            $documents = $this->getApplicantDocuments((int)$id);
            $this->response(true, 'Applicant document deleted successfully.', ['documents' => $documents]);
        } catch (Exception $e) {
            error_log('Applicant document deletion error: ' . $e->getMessage());
            $this->response(false, 'Failed to delete applicant document.', [], 500);
        }
    }

    /**
     * DELETE: /api/applicants/{id}
     * Deletes an applicant.
     */
    public function delete(?string $id = null): void {
        $this->checkPermission(['Admin']);

        if (!$id) {
            $this->response(false, 'Applicant ID is required', [], 400);
            return;
        }

        $franchiseCount = Database::fetch('SELECT COUNT(*) as cnt FROM franchises WHERE ApplicantID = ?', [$id]);
        if ($franchiseCount && $franchiseCount['cnt'] > 0) {
            $this->response(false, 'Cannot delete. Applicant is associated with ' . $franchiseCount['cnt'] . ' franchise(s).', [], 409);
            return;
        }

        try {
            $this->deleteAllApplicantDocuments((int)$id);

            $stmt = Database::query('DELETE FROM applicants WHERE id = ?', [$id]);
            $rowCount = $stmt->rowCount();

            if ($rowCount > 0) {
                $this->response(true, 'Applicant deleted successfully');
            } else {
                $this->response(false, 'Applicant not found', [], 404);
            }
        } catch (Exception $e) {
            error_log('Applicant deletion error: ' . $e->getMessage());
            $this->response(false, 'Failed to delete applicant', [], 500);
        }
    }

    /**
     * Fetches detailed applicant information.
     */
    private function getApplicant(int $id): ?array {
        $applicantRec = Database::fetch("
            SELECT 
                a.id, a.FirstName, a.LastName, a.MiddleName, a.Address, a.ContactNo, a.Gender,
                a.CreatedAt, a.UpdatedAt,
                CONCAT(cu.FirstName, ' ', cu.LastName) as CreatedByName,
                CONCAT(uu.FirstName, ' ', uu.LastName) as UpdatedByName
            FROM applicants a
            LEFT JOIN users cu ON cu.UserID = a.CreatedBy
            LEFT JOIN users uu ON uu.UserID = a.UpdatedBy
            WHERE a.id = ?
        ", [$id]);

        return $applicantRec ?: null;
    }

    private function getApplicantDocuments(int $applicantId): array {
        $documents = Database::fetchAll(
            "SELECT 
                id,
                ApplicantID,
                OriginalFileName,
                FilePath,
                FileSize,
                MimeType,
                CreatedBy,
                UpdatedBy,
                CreatedAt,
                UpdatedAt
            FROM applicant_documents
            WHERE ApplicantID = ?
            ORDER BY CreatedAt DESC, id DESC",
            [$applicantId]
        );

        foreach ($documents as &$document) {
            $documentId = (int)($document['id'] ?? 0);
            $document['StreamUrl'] = '/api/applicants/' . $applicantId . '/documents/' . $documentId . '/stream';
            $document['Label'] = 'PDF';
        }
        unset($document);

        return $documents;
    }

    private function normalizeUploadedFiles(string $fieldName): array {
        if (!isset($_FILES[$fieldName])) {
            return [];
        }

        $fileData = $_FILES[$fieldName];
        if (!is_array($fileData['name'])) {
            return [$fileData];
        }

        $normalized = [];
        $count = count($fileData['name']);
        for ($index = 0; $index < $count; $index++) {
            $normalized[] = [
                'name' => $fileData['name'][$index] ?? '',
                'type' => $fileData['type'][$index] ?? '',
                'tmp_name' => $fileData['tmp_name'][$index] ?? '',
                'error' => $fileData['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                'size' => $fileData['size'][$index] ?? 0,
            ];
        }

        return array_values(array_filter($normalized, static function (array $file): bool {
            return (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        }));
    }

    private function validatePdfUpload(array $file): ?string {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return 'One of the selected files failed to upload.';
        }

        $fileName = (string)($file['name'] ?? '');
        $extension = strtolower((string)pathinfo($fileName, PATHINFO_EXTENSION));
        if ($extension !== 'pdf') {
            return 'Only PDF files are allowed for applicant requirements.';
        }

        $fileSize = (int)($file['size'] ?? 0);
        if ($fileSize <= 0) {
            return 'One of the selected files is empty.';
        }

        if ($fileSize > self::MAX_DOCUMENT_SIZE_BYTES) {
            return 'Each applicant requirement PDF must be 50 MB or smaller.';
        }

        $tmpName = (string)($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            return 'Invalid uploaded PDF file.';
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = $finfo ? (string)finfo_file($finfo, $tmpName) : '';
        if ($finfo) {
            finfo_close($finfo);
        }

        if (!in_array($mimeType, self::ALLOWED_DOCUMENT_MIME_TYPES, true)) {
            return 'Only scanned PDF files are allowed.';
        }

        return null;
    }

    private function deleteAllApplicantDocuments(int $applicantId): void {
        $documents = Database::fetchAll('SELECT id, FilePath FROM applicant_documents WHERE ApplicantID = ?', [$applicantId]);

        foreach ($documents as $document) {
            $filePath = (string)($document['FilePath'] ?? '');
            if ($filePath !== '') {
                R2StorageHelper::delete($filePath);
            }
        }

        Database::query('DELETE FROM applicant_documents WHERE ApplicantID = ?', [$applicantId]);
    }
}
