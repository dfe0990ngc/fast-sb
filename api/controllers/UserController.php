<?php
declare(strict_types=1);

namespace App\controllers;

use App\controllers\Controller;
use App\core\Database;
use Exception;

class UserController extends Controller {

    /**
     * GET: /api/users
     * Retrieves a paginated list of users.
     */
    public function index(): void {
        $this->checkPermission(['Admin']);

        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        $search = $_GET['search'] ?? null;
        $offset = ($page - 1) * $limit;

        $baseQuery = "FROM users WHERE id != 1";
        $params = [];

        if ($search) {
            $baseQuery .= " AND (FirstName LIKE ? OR LastName LIKE ? OR UserID LIKE ?)";
            $searchTerm = "%{$search}%";
            $params = [$searchTerm, $searchTerm, $searchTerm];
        }

        // Get total count
        $totalResult = Database::fetch("SELECT COUNT(*) as cnt " . $baseQuery, $params);
        $total = $totalResult['cnt'] ?? 0;

        // Get paginated data
        $query = "SELECT UserID, FirstName, LastName, UserType, CreatedAt, LastLogin " . $baseQuery . " ORDER BY LastName ASC, FirstName ASC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        $users = Database::fetchAll($query, $params);

        $this->response(true, 'Users retrieved successfully', [
            'users' => $users,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $limit,
                'total' => (int)$total,
                'total_pages' => (int)ceil((int)$total / $limit)
            ]
        ]);
    }

    /**
     * GET: /api/users/{id}
     * Retrieves a single user.
     */
    public function show(?string $id = null): void {
        $this->checkPermission(['Admin']);

        if (!$id) {
            $this->response(false, 'User ID is required', [], 400);
        }

        $user = $this->getUser($id);

        if (!$user) {
            $this->response(false, 'User not found', [], 404);
        }

        $this->response(true, 'User retrieved successfully', ['user' => $user]);
    }

    /**
     * GET: /api/my-profile
     * Retrieves the profile of the currently authenticated user.
     */
    public function getProfile(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);

        $authUserID = $this->getAuthenticatedUser();
        if (!$authUserID) {
            $this->response(false, 'Authentication required to access profile', [], 401);
        }

        $user = $this->getUser($authUserID);

        if (!$user) {
            // This case is unlikely if the user is authenticated, but it's good practice to handle it.
            $this->response(false, 'Authenticated user profile not found', [], 404);
        }

        $this->response(true, 'Profile retrieved successfully', ['user' => $user]);
    }

    /**
     * PUT: /api/my-profile
     * Retrieves the profile of the currently authenticated user.
     */
    public function updateProfile(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);

        $data = $this->getJsonInput();
        
        $authUserID = $this->getAuthenticatedUser();
        
        try {
            Database::update('users', [
                'FirstName' => $data['FirstName'],
                'LastName' => $data['LastName'],
                'UpdatedBy' => $authUserID
            ], 'UserID = :UserID', ['UserID' => $authUserID]);

            $user = $this->getUser($authUserID);
            
            $this->response(true, 'Profile updated successfully', ['user' => $user], 200);
        } catch (Exception $e) {
            error_log('Profile update error: ' . $e->getMessage());
            $this->response(false, 'Failed to update profile', [], 500);
        }
    }

    /**
     * POST: /api/users
     * Creates a new user.
     */
    public function create(): void {
        $this->checkPermission(['Admin']);
        
        $data = $this->getJsonInput();
        
        // Validate required fields
        $required = ['UserID', 'FirstName', 'LastName', 'Password', 'UserType'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                $this->response(false, "Field '{$field}' is required", [], 400);
            }
        }
        
        // Check if UserID (username) already exists
        $existing = Database::fetch("SELECT UserID FROM users WHERE UserID = ?", [$data['UserID']]);
        if ($existing) {
            $this->response(false, 'Username (UserID) already exists', [], 409);
        }
        
        $authUserID = $this->getAuthenticatedUser();
        
        try {
            $id = Database::insert('users', [
                'UserID' => $data['UserID'],
                'FirstName' => $data['FirstName'],
                'LastName' => $data['LastName'],
                'PasswordHash' => password_hash($data['Password'], PASSWORD_DEFAULT),
                'UserType' => $data['UserType'],
                'CreatedBy' => $authUserID,
                'UpdatedBy' => $authUserID
            ]);

            $user = $this->getUser($data['UserID']);
            
            $this->response(true, 'User created successfully', ['user' => $user], 201);
        } catch (Exception $e) {
            error_log('User creation error: ' . $e->getMessage());
            $this->response(false, 'Failed to create user', [], 500);
        }
    }
    
    /**
     * PUT: /api/users/{id}
     * Updates an existing user.
     */
    public function update(?string $id = null): void {
        $this->checkPermission(['Admin']);
        
        if (!$id) {
            $this->response(false, 'User ID is required', [], 400);
        }
        
        $data = $this->getJsonInput();
        
        $existing = Database::fetch("SELECT * FROM users WHERE UserID = ?", [$id]);
        if (!$existing) {
            $this->response(false, 'User not found', [], 404);
        }
        
        $authUserID = $this->getAuthenticatedUser();
        
        // Build update data
        $updateData = [];
        $allowedFields = ['FirstName', 'LastName', 'UserType'];
        
        foreach ($allowedFields as $field) {
            if (isset($data[$field]) && $data[$field] !== $existing[$field]) {
                $updateData[$field] = $data[$field];
            }
        }

        // Handle password update
        if (!empty($data['Password'])) {
            $updateData['PasswordHash'] = password_hash($data['Password'], PASSWORD_DEFAULT);
        }
        
        if (empty($updateData)) {
            $this->response(true, 'No changes made to user', ['user' => $this->getUser($id)]);
        }
        
        $updateData['UpdatedBy'] = $authUserID;
        
        try {
            Database::update('users', $updateData, 'UserID = :UserID', ['UserID' => $id]);
            
            $user = $this->getUser($id);

            $this->response(true, 'User updated successfully', ['user' => $user]);
        } catch (Exception $e) {
            error_log('User update error: ' . $e->getMessage());
            $this->response(false, 'Failed to update user', [], 500);
        }
    }
    
    /**
     * DELETE: /api/users/{id}
     * Deletes a user.
     */
    public function delete(?string $id = null): void {
        $this->checkPermission(['Admin']);
        
        if (!$id) {
            $this->response(false, 'User ID is required', [], 400);
        }

        // Prevent user from deleting themselves
        $authUserID = $this->getAuthenticatedUser();
        if ($id === $authUserID) {
            $this->response(false, 'You cannot delete your own account', [], 403);
        }
        
        try {
            $stmt = Database::query("DELETE FROM users WHERE UserID = ?", [$id]);
            $rowCount = $stmt->rowCount();
            
            if ($rowCount > 0) {
                $this->response(true, 'User deleted successfully');
            } else {
                $this->response(false, 'User not found', [], 404);
            }
        } catch (Exception $e) {
            // Check for foreign key constraint violation if a user is linked to other records
            if ($e->getCode() == '23000') {
                 $this->response(false, 'Cannot delete user. They are associated with other records.', [], 409);
            }
            error_log('User deletion error: ' . $e->getMessage());
            $this->response(false, 'Failed to delete user', [], 500);
        }
    }

    /**
     * Fetches detailed user information.
     */
    private function getUser(string $id): ?array {
        $userRec = Database::fetch("
            SELECT 
                u.id,
                u.UserID, u.FirstName, u.LastName, u.UserType, u.CreatedAt, u.UpdatedAt, u.LastLogin,
                CONCAT(cu.FirstName, ' ', cu.LastName) as CreatedByName,
                CONCAT(uu.FirstName, ' ', uu.LastName) as UpdatedByName
            FROM users u
            LEFT JOIN users cu ON cu.UserID = u.CreatedBy
            LEFT JOIN users uu ON uu.UserID = u.UpdatedBy
            WHERE u.UserID = ?
        ", [$id]);

        return $userRec ?: null;
    }
}