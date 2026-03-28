<?php
declare(strict_types=1);

namespace App\controllers;

use App\services\franchise\FranchiseDocumentService;
use App\core\R2StorageHelper;
use Exception;

class FranchiseDocumentController extends Controller
{
    private FranchiseDocumentService $service;

    public function __construct()
    {
        $this->service = new FranchiseDocumentService();
    }

    public function uploadDocuments(?string $id = null): void
    {
        $this->checkPermission(['Admin', 'Editor']);

        if (!$id) {
            $this->response(false, 'Franchise ID is required.', [], 400);
            return;
        }

        try {
            $documents = $this->service->uploadDocuments((int)$id, (int)$this->getAuthenticatedUser());
            $this->response(true, 'Driver authorization PDFs uploaded successfully.', ['documents' => $documents], 201);
        } catch (Exception $e) {
            error_log('Franchise document upload error: ' . $e->getMessage());
            $status = str_contains(strtolower($e->getMessage()), 'not found') ? 404 : 500;
            $this->response(false, $e->getMessage(), [], $status);
        }
    }

    public function streamDocument(?string $id = null, ?string $documentId = null): void
    {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);

        if (!$id || !$documentId) {
            $this->response(false, 'Franchise ID and document ID are required.', [], 400);
            return;
        }

        $document = $this->service->findDocument((int)$id, (int)$documentId);

        if (!$document) {
            $this->response(false, 'Franchise document not found.', [], 404);
            return;
        }

        $filePath = (string)($document['FilePath'] ?? '');
        if ($filePath === '') {
            $this->response(false, 'Document file path is missing.', [], 404);
            return;
        }

        $fileName = (string)($document['OriginalFileName'] ?? ('franchise-document-' . $documentId . '.pdf'));
        R2StorageHelper::streamToBrowser($filePath, $fileName, 'application/pdf', true);
    }

    public function deleteDocument(?string $id = null, ?string $documentId = null): void
    {
        $this->checkPermission(['Admin', 'Editor']);

        if (!$id || !$documentId) {
            $this->response(false, 'Franchise ID and document ID are required.', [], 400);
            return;
        }

        try {
            $documents = $this->service->deleteDocument((int)$id, (int)$documentId);
            $this->response(true, 'Franchise document deleted successfully.', ['documents' => $documents]);
        } catch (Exception $e) {
            error_log('Franchise document deletion error: ' . $e->getMessage());
            $status = str_contains(strtolower($e->getMessage()), 'not found') ? 404 : 500;
            $this->response(false, $e->getMessage(), [], $status);
        }
    }
}
