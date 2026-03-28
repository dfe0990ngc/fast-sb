<?php
declare(strict_types=1);

namespace App\services\franchise;

use App\core\Database;
use App\core\R2StorageHelper;
use App\services\documents\PdfUploadSupport;
use Exception;

final class FranchiseDocumentService
{
    private const STORAGE_FOLDER = 'franchise-driver-authorizations';
    private const DOCUMENT_LABEL = 'driver authorization PDFs';

    public function franchiseExists(int $franchiseId): bool
    {
        $franchise = Database::fetch('SELECT id FROM franchises WHERE id = ? LIMIT 1', [$franchiseId]);
        return (bool)$franchise;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getDocuments(int $franchiseId): array
    {
        $documents = Database::fetchAll(
            "SELECT
                id,
                FranchiseID,
                OriginalFileName,
                FilePath,
                FileSize,
                MimeType,
                CreatedBy,
                UpdatedBy,
                CreatedAt,
                UpdatedAt
            FROM franchise_documents
            WHERE FranchiseID = ?
            ORDER BY CreatedAt DESC, id DESC",
            [$franchiseId]
        );

        foreach ($documents as &$document) {
            $documentId = (int)($document['id'] ?? 0);
            $document['StreamUrl'] = '/api/franchises/' . $franchiseId . '/documents/' . $documentId . '/stream';
            $document['Label'] = 'Authorization PDF';
        }
        unset($document);

        return $documents;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function uploadDocuments(int $franchiseId, int $authUserId): array
    {
        if (!$this->franchiseExists($franchiseId)) {
            throw new Exception('Franchise not found.');
        }

        $files = PdfUploadSupport::normalizeUploadedFiles('documents');
        if (empty($files)) {
            $files = PdfUploadSupport::normalizeUploadedFiles('files');
        }

        $batchError = PdfUploadSupport::validateBatch(
            $files,
            count($this->getDocuments($franchiseId)),
            'franchise',
            self::DOCUMENT_LABEL
        );

        if ($batchError !== null) {
            throw new Exception($batchError);
        }

        $uploadedKeys = [];
        $createdIds = [];

        try {
            foreach ($files as $file) {
                $validationError = PdfUploadSupport::validatePdfUpload($file, self::DOCUMENT_LABEL);
                if ($validationError !== null) {
                    throw new Exception($validationError);
                }

                $uploadResult = R2StorageHelper::uploadFromRequest(
                    $file,
                    self::STORAGE_FOLDER . '/' . $franchiseId,
                    PdfUploadSupport::ALLOWED_MIME_TYPES,
                    PdfUploadSupport::MAX_FILE_SIZE_BYTES
                );

                if (!($uploadResult['success'] ?? false)) {
                    throw new Exception((string)($uploadResult['message'] ?? 'Failed to upload PDF document.'));
                }

                $uploadedKeys[] = (string)$uploadResult['file_path'];

                $createdIds[] = Database::insert('franchise_documents', [
                    'FranchiseID' => $franchiseId,
                    'OriginalFileName' => (string)$file['name'],
                    'FilePath' => (string)$uploadResult['file_path'],
                    'FileSize' => (int)($uploadResult['file_size'] ?? $file['size'] ?? 0),
                    'MimeType' => 'application/pdf',
                    'CreatedBy' => $authUserId,
                    'UpdatedBy' => $authUserId,
                ]);
            }

            return $this->getDocuments($franchiseId);
        } catch (Exception $e) {
            foreach ($createdIds as $createdId) {
                try {
                    Database::query('DELETE FROM franchise_documents WHERE id = ?', [$createdId]);
                } catch (Exception $rollbackException) {
                    error_log('Franchise document rollback DB error: ' . $rollbackException->getMessage());
                }
            }

            foreach ($uploadedKeys as $uploadedKey) {
                try {
                    R2StorageHelper::delete($uploadedKey);
                } catch (Exception $rollbackException) {
                    error_log('Franchise document rollback file error: ' . $rollbackException->getMessage());
                }
            }

            throw $e;
        }
    }

    public function findDocument(int $franchiseId, int $documentId): ?array
    {
        $document = Database::fetch(
            'SELECT * FROM franchise_documents WHERE id = ? AND FranchiseID = ? LIMIT 1',
            [$documentId, $franchiseId]
        );

        return $document ?: null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function deleteDocument(int $franchiseId, int $documentId): array
    {
        $document = $this->findDocument($franchiseId, $documentId);
        if (!$document) {
            throw new Exception('Franchise document not found.');
        }

        $fileDeleted = true;
        $filePath = (string)($document['FilePath'] ?? '');
        if ($filePath !== '') {
            $fileDeleted = R2StorageHelper::delete($filePath);
        }

        if (!$fileDeleted) {
            throw new Exception('Failed to delete the document file from storage.');
        }

        Database::query('DELETE FROM franchise_documents WHERE id = ? AND FranchiseID = ?', [$documentId, $franchiseId]);

        return $this->getDocuments($franchiseId);
    }

    public function deleteAllDocuments(int $franchiseId): void
    {
        $documents = Database::fetchAll(
            'SELECT id, FilePath FROM franchise_documents WHERE FranchiseID = ?',
            [$franchiseId]
        );

        foreach ($documents as $document) {
            $filePath = (string)($document['FilePath'] ?? '');
            if ($filePath !== '') {
                R2StorageHelper::delete($filePath);
            }
        }

        Database::query('DELETE FROM franchise_documents WHERE FranchiseID = ?', [$franchiseId]);
    }
}
