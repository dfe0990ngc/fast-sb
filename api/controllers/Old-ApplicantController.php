<?php
declare(strict_types=1);

namespace App\controllers;

use App\controllers\Controller;
use App\core\Database;
use Exception;

class ApplicantController extends Controller {

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
            $baseQuery .= " WHERE (FirstName LIKE ? OR LastName LIKE ? OR ContactNo LIKE ?)";
            $searchTerm = "%{$search}%";
            $params = [$searchTerm, $searchTerm, $searchTerm];
        }

        // Get total count
        $totalResult = Database::fetch("SELECT COUNT(*) as cnt " . $baseQuery, $params);
        $total = $totalResult['cnt'] ?? 0;

        // Get paginated data
        $query = "SELECT id, FirstName, LastName, MiddleName, Address, ContactNo " . $baseQuery . " ORDER BY LastName ASC, FirstName ASC LIMIT ? OFFSET ?";
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
        }

        $applicant = $this->getApplicant((int)$id);

        if (!$applicant) {
            $this->response(false, 'Applicant not found', [], 404);
        }

        // Fetch all franchises associated with the applicant
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

        $this->response(true, 'Applicant and their franchises retrieved successfully', ['applicant' => $applicant]);
    }

    /**
     * POST: /api/applicants
     * Creates a new applicant.
     */
    public function create(): void {
        $this->checkPermission(['Admin', 'Editor']);
        
        $data = $this->getJsonInput();
        
        // Validate required fields
        $required = ['FirstName', 'LastName', 'Address'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                $this->response(false, "Field '{$field}' is required", [], 400);
            }
        }
        
        $authUserID = $this->getAuthenticatedUser();
        
        try {
            $id = Database::insert('applicants', [
                'FirstName' => $data['FirstName'],
                'LastName' => $data['LastName'],
                'MiddleName' => $data['MiddleName'] ?? null,
                'Address' => $data['Address'],
                'ContactNo' => $data['ContactNo'] ?? null,
                'CreatedBy' => $authUserID,
                'UpdatedBy' => $authUserID
            ]);

            $applicant = $this->getApplicant((int)$id);
            
            $this->response(true, 'Applicant created successfully', ['applicant' => $applicant], 201);
        } catch (Exception $e) {
            error_log('Applicant creation error: ' . $e->getMessage());
            $this->response(false, 'Failed to create applicant', [], 500);
        }
    }
    
    /**
     * PUT: /api/applicants/{id}
     * Updates an existing applicant.
     */
    public function update(?string $id = null): void {
        $this->checkPermission(['Admin', 'Editor']);
        
        if (!$id) {
            $this->response(false, 'Applicant ID is required', [], 400);
        }
        
        $data = $this->getJsonInput();
        
        $existing = Database::fetch("SELECT * FROM applicants WHERE id = ?", [$id]);
        if (!$existing) {
            $this->response(false, 'Applicant not found', [], 404);
        }
        
        $authUserID = $this->getAuthenticatedUser();
        
        // Build update data
        $updateData = [];
        $allowedFields = ['FirstName', 'LastName', 'MiddleName', 'Address', 'ContactNo'];
        
        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updateData[$field] = $data[$field];
            }
        }
        
        if (empty($updateData)) {
            $this->response(true, 'No changes made to applicant', ['applicant' => $this->getApplicant((int)$id)]);
        }
        
        $updateData['UpdatedBy'] = $authUserID;
        
        try {
            Database::update('applicants', $updateData, 'id = :id', ['id' => $id]);
            
            $applicant = $this->getApplicant((int)$id);

            $this->response(true, 'Applicant updated successfully', ['applicant' => $applicant]);
        } catch (Exception $e) {
            error_log('Applicant update error: ' . $e->getMessage());
            $this->response(false, 'Failed to update applicant', [], 500);
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
        }

        // Check if applicant is associated with any franchises
        $franchiseCount = Database::fetch("SELECT COUNT(*) as cnt FROM franchises WHERE ApplicantID = ?", [$id]);
        if ($franchiseCount && $franchiseCount['cnt'] > 0) {
            $this->response(false, 'Cannot delete. Applicant is associated with ' . $franchiseCount['cnt'] . ' franchise(s).', [], 409);
        }
        
        try {
            $stmt = Database::query("DELETE FROM applicants WHERE id = ?", [$id]);
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
                a.id, a.FirstName, a.LastName, a.MiddleName, a.Address, a.ContactNo,
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
}