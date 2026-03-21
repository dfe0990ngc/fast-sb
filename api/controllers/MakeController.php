<?php
declare(strict_types=1);

namespace App\controllers;

use App\controllers\Controller;
use App\core\Database;
use Exception;

class MakeController extends Controller {
    
    public function index(): void {
        
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);

        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $search = $_GET['search'] ?? null;
        $offset = ($page - 1) * $limit;

        $baseQuery = "FROM makes";
        $params = [];

        if ($search) {
            $baseQuery .= " WHERE Name LIKE ?";
            $params[] = "%{$search}%";
        }

        // Get total count
        $totalResult = Database::fetch("SELECT COUNT(*) as cnt " . $baseQuery, $params);
        $total = $totalResult['cnt'];

        // Get paginated data
        $query = "SELECT * " . $baseQuery . " ORDER BY Name ASC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        $makes = Database::fetchAll($query, $params);

        $this->response(true, 'Makes retrieved successfully', [
            'makes' => $makes,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $limit,
                'total' => $total,
                'total_pages' => (int)ceil($total / $limit)
            ]
        ]);
    }

    public function indexJSON(): void {
        
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);

        $makes = Database::fetchAll("SELECT * FROM makes ORDER BY Name ASC");

        $this->response(true, 'Makes retrieved successfully', [
            'makes' => $makes,
        ]);
    }

    // POST: Create new franchise
    public function create(): void {
        $this->checkPermission(['Admin', 'Editor']);
        
        $data = $this->getJsonInput();
        
        // Validate required fields
        $required = ['Name'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                $this->response(false, "Field '{$field}' is required", [], 400);
            }
        }
        
        // Check if Make already exists
        $existing = Database::fetch(
            "SELECT id FROM makes WHERE Name LIKE ?",
            [$data['Name']]
        );
        
        if ($existing) {
            $this->response(false, 'Make already exists', [], 409);
        }
        
        $userID = $this->getAuthenticatedUser();
        
        try {
            
            $id = Database::insert('makes', [
                'Name' => $data['Name'],
                'Description' => $data['Description'],
                'IsActive' => 1,
                'CreatedBy' => $userID,
                'UpdatedBy' => $userID
            ]);

            $make = $this->getMake($id);
            
            $this->response(true, 'Make Created successfully', [
                'make' => $make
            ], 201);
        } catch (Exception $e) {
            error_log('Make record creation error: ' . $e->getMessage());
            $this->response(false, 'Failed to create make record', [], 500);
        }
    }
    
    // PUT: Update franchise
    public function update(?string $id = null): void {
        $this->checkPermission(['Admin', 'Editor']);
        
        if (!$id) {
            $this->response(false, 'Make ID is required', [], 400);
        }
        
        $data = $this->getJsonInput();
        
        // Check if franchise exists and get current data
        $existing = Database::fetch("SELECT * FROM makes WHERE id = ?", [$id]);
        if (!$existing) {
            $this->response(false, 'Make not found', [], 404);
        }
        
        $userID = $this->getAuthenticatedUser();
        
        // Build update data
        $updateData = [];
        $allowedFields = ['Name', 'Description','IsActive'];
        
        $changes = [];
        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== $existing[$field]) {
                $updateData[$field] = $data[$field];
                $changes[$field] = [
                    'from' => $existing[$field],
                    'to' => $data[$field]
                ];
            }
        }
        
        if (empty($updateData)) {
            $this->response(false, 'No fields to update', [], 400);
        }
        
        $updateData['UpdatedBy'] = $userID;
        
        // Check if Name is being changed and already exists
        if (!empty($data['Name']) && $data['Name'] !== $existing['Name']) {
            $duplicate = Database::fetch(
                "SELECT id FROM makes WHERE Name LIKE ?",
                [$data['Name']]
            );
            if ($duplicate) {
                $this->response(false, 'Make already exists', [], 409);
            }
        }
        
        try {
            // Update make
            $rowCount = Database::update('makes', $updateData, 'id = :id', ['id' => $id]);
            
            $make = $this->getMake($id);

            if ($rowCount > 0 || !empty($changes)) {
                $this->response(true, 'Make updated successfully', [
                    'make' => $make,
                ]);
            } else {
                $this->response(false, 'No changes made to franchise', [], 304);
            }
        } catch (Exception $e) {
            error_log('Make update error: ' . $e->getMessage());
            $this->response(false, 'Failed to update make', [], 500);
        }
    }
    
    // DELETE: Delete franchise
    public function delete(?string $id = null): void {
        $this->checkPermission(['Admin']);
        
        if (!$id) {
            $this->response(false, 'Make ID is required', [], 400);
        }
        
        try {
            $stmt = Database::query("DELETE FROM makes WHERE id = ?", [$id]);
            $rowCount = $stmt->rowCount();
            
            if ($rowCount > 0) {
                $this->response(true, 'Make deleted successfully');
            } else {
                $this->response(false, 'Make not found', [], 404);
            }
        } catch (Exception $e) {
            error_log('Make deletion error: ' . $e->getMessage());
            $this->response(false, 'Failed to delete make', [], 500);
        }
    }

    private function getMake($id): array {

        $makeRec = Database::fetch("
            SELECT mk.*, 
                CONCAT(cu.FirstName,' ',cu.LastName) as CreatedByName,
                CONCAT(uu.FirstName,' ',uu.LastName) as UpdatedByName
            FROM makes mk
            LEFT JOIN users cu ON(cu.UserID = mk.CreatedBy)
            LEFT JOIN users uu ON(uu.UserID = mk.UpdatedBy)
            WHERE mk.id = ?
        ",[$id]);

        return $makeRec ?? [];
    }
}