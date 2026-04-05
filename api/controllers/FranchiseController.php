<?php
declare(strict_types=1);

namespace App\controllers;

use App\core\Database;
use Exception;
use App\core\Auth;
use App\services\franchise\FranchiseDocumentService;
use DateTime;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class FranchiseController extends Controller{
    
    // GET: List all franchises with filters
    public function index(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        $status = $_GET['status'] ?? null;
        $makeID = $_GET['make_id'] ?? null;
        $route = $_GET['route'] ?? null;
        $year = $_GET['year'] ?? null;
        $search = $_GET['search'] ?? null;
        $page = (int)($_GET['page'] ?? 1);
        $limit = (int)($_GET['limit'] ?? 10);
        $offset = ($page - 1) * $limit;
        
        $sql = "
            SELECT 
                f.id, 
                lh.id as histID,
                f.FranchiseNo,
                f.ApplicantID,
                f.Driver,
                lh.DateIssued,
                f.Route,
                f.MakeID,
                f.ChassisNo,
                f.EngineNo,
                f.PlateNo,
                lh.ORNo,
                lh.Amount,
                lh.NewStatus as Status,
                lh.DropReason,
                f.RenewalCount,
                f.LastRenewalDate,
                lh.ExpiryDate,
                tblH.ExpiryDate as LatestExpiryDate,
                CONCAT(a.FirstName,' ',a.LastName) as ApplicantName,
                a.Gender,
                a.ContactNo,
                a.Address,
                m.Name as MakeName,
                CONCAT(u1.FirstName, ' ', u1.LastName) as CreatedByName,
                CONCAT(u2.FirstName, ' ', u2.LastName) as UpdatedByName
            FROM franchises f
            LEFT JOIN franchise_history lh ON f.id = lh.FranchiseID
            LEFT JOIN (
                SELECT FranchiseID, MAX(ExpiryDate) ExpiryDate 
                FROM franchise_history 
                GROUP BY FranchiseID
            ) tblH on tblH.FranchiseID = f.id
            LEFT JOIN applicants a ON a.id = f.ApplicantID
            LEFT JOIN makes m ON f.MakeID = m.id
            LEFT JOIN users u1 ON f.CreatedBy = u1.UserID
            LEFT JOIN users u2 ON f.UpdatedBy = u2.UserID
            WHERE 1=1";
        
        $params = [];
        
        if ($status) {
            $sql .= " AND lh.NewStatus = ?";
            $params[] = $status;
        }
        
        if ($makeID) {
            $sql .= " AND f.MakeID = ?";
            $params[] = $makeID;
        }
        
        if ($route) {
            $sql .= " AND f.Route LIKE ?";
            $params[] = "%{$route}%";
        }
        
        if ($year) {
            $sql .= " AND YEAR(lh.DateIssued) = ?";
            $params[] = $year;
        }
        
        if ($search) {
            $sql .= " AND (f.FranchiseNo LIKE ? OR lh.PlateNo LIKE ? OR lh.ORNo LIKE ? OR a.Address LIKE ? OR 
                    a.ContactNo LIKE ? OR lh.DateIssued LIKE ? OR f.ChassisNo LIKE ? OR f.EngineNo LIKE ? OR 
                    lh.DropReason LIKE ? OR lh.ExpiryDate LIKE ? OR f.LastRenewalDate LIKE ? OR f.Driver LIKE ? OR a.FirstName LIKE ? OR a.LastName LIKE ?)";
            $searchParam = "%{$search}%";
            for ($i = 0; $i < 14; $i++) {
                $params[] = $searchParam;
            }
        }
        
        $totalResult = Database::fetch("SELECT COUNT(DISTINCT tbl.id) as total FROM (SELECT tblIn.* FROM (".$sql.") tblIn) tbl",$params);
        $total = $totalResult['total'] ?? 0;

        $sql .= " ORDER BY lh.id DESC, f.id DESC";
        $_sql = "SELECT DISTINCT * FROM (
            SELECT ROW_NUMBER() OVER(PARTITION BY id ORDER BY histID DESC, id DESC) as rn,
            tblIn.* FROM (".$sql.") tblIn 
        ) tbl WHERE tbl.rn = 1 LIMIT ? OFFSET ?";

        $params[] = $limit;
        $params[] = $offset;

        // echo $_sql."\n";
        // print_r($params);
        // die();
        
        $franchises = Database::fetchAll($_sql, $params);
        
        $this->response(true, 'Franchises retrieved successfully', [
            'franchises' => $franchises,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $limit,
                'total' => $total,
                'total_pages' => ceil($total / $limit)
            ]
        ]);
    }
    
    // GET: Single franchise details
    public function show(?string $id = null): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        if (!$id) {
            $this->response(false, 'Franchise ID is required', [], 400);
        }

        $franchise = $this->getFranchise($id);
        $histories = $this->getFranchiseHistories($id);
        
        if (!$franchise) {
            $this->response(false, 'Franchise not found', [], 404);
        }
        
        $this->response(true, 'Franchise retrieved successfully', [
            'franchise' => $franchise,
            'franchise_histories' => $histories,
        ]);
    }
    
    // POST: Create new franchise
    public function create(): void {
        $this->checkPermission(['Admin', 'Editor']);
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Validate required fields
        $required = ['ApplicantID', 'FranchiseNo', 'DateIssued', 'Route', 'MakeID', 'ChassisNo', 'EngineNo', 'PlateNo'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                $this->response(false, "Field '{$field}' is required", [], 400);
            }
        }
        
        // Check if franchise number already exists
        $existing = Database::fetch(
            "SELECT id FROM franchises WHERE FranchiseNo = ? AND ChassisNo = ? AND EngineNo = ? AND ApplicantID = ?",
            [$data['FranchiseNo'], $data['ChassisNo'], $data['EngineNo'],$data['ApplicantID']]
        );
        
        if ($existing) {
            $this->response(false, 'Franchise of this unit already exists', [], 409);
        }
        
        $userID = $this->getAuthenticatedUser();
        $status = $data['Status'] ?? 'new';

        $RenewalCount = 0;
        if($status == 'renew'){
            $RenewalCount = 1;
        }
        
        try {
            // Insert franchise
            $id = Database::insert('franchises', [
                'ApplicantID' => $data['ApplicantID'],
                'FranchiseNo' => $data['FranchiseNo'],
                'Driver' => $data['Driver'] ?? null,
                'DateIssued' => $data['DateIssued'],
                'Route' => $data['Route'],
                'MakeID' => $data['MakeID'],
                'ChassisNo' => $data['ChassisNo'],
                'EngineNo' => $data['EngineNo'],
                'PlateNo' => $data['PlateNo'],
                'ORNo' => $data['ORNo'] ?? null,
                'Amount' => $data['Amount'] ?? null,
                'Status' => $status,
                'DropReason' => $data['DropReason'] ?? null,
                'ExpiryDate' => $data['ExpiryDate'] ?? null,
                'CreatedBy' => $userID,
                'UpdatedBy' => $userID,
                'RenewalCount' => $RenewalCount,
                // 'LastRenewalDate' => $data['LastRenewalDate'] ?? null,
            ]);

            $rm = "Initial franchise creation";
            if($status != 'new'){
                $rm = "Initial record entry";
            }
            
            // Record in history
            Database::insert('franchise_history', [
                'FranchiseID' => $id,
                'ActionType' => $status,
                'NewStatus' => $status,
                'DateIssued' => $data['DateIssued'],
                'ExpiryDate' => $data['ExpiryDate'] ?? null,
                'Route' => $data['Route'],
                'PlateNo' => $data['PlateNo'],
                'ORNo' => $data['ORNo'],
                'Amount' => $data['Amount'],
                'Remarks' => $rm,
                'CreatedBy' => $userID
            ]);

            $franchise = $this->getFranchise($id);
            $histories = $this->getFranchiseHistories($id);
            
            $this->response(true, 'Franchise created successfully', [
                'franchise' => $franchise,
                'franchise_histories' => $histories,
            ], 201);
        } catch (Exception $e) {
            error_log('Franchise creation error: ' . $e->getMessage());
            $this->response(false, 'Failed to create franchise', [], 500);
        }
    }
    
    // PUT: Update franchise
    public function update(?string $id = null): void {
        $this->checkPermission(['Admin', 'Editor']);
        
        if (!$id) {
            $this->response(false, 'Franchise ID is required', [], 400);
        }
        
        $data = $this->getJsonInput();
        
        // Check if franchise exists and get current data
        $existing = Database::fetch("SELECT * FROM franchises WHERE id = ?", [$id]);
        if (!$existing) {
            $this->response(false, 'Franchise not found', [], 404);
        }
        
        // Check if franchise number is being changed and already exists
        if (!empty($data['FranchiseNo']) && $data['FranchiseNo'] !== $existing['FranchiseNo']) {
            $duplicate = Database::fetch(
                "SELECT id FROM franchises WHERE FranchiseNo = ? AND ChassisNo = ? AND EngineNo = ? AND ApplicantID = ? AND id != ?",
                [$data['FranchiseNo'], $data['ChassisNo'], $data['EngineNo'], $existing['ApplicantID'], $id]
            );
            if ($duplicate) {
                $this->response(false, 'Franchise already exists', [], 409);
            }
        }
        
        $userID = Auth::id();
        
        // Build update data
        $updateData = [];
        $allowedFields = ['FranchiseNo', 'Driver', 'DateIssued', 'Route', 'MakeID', 'ChassisNo', 'EngineNo', 'PlateNo', 'ORNo', 'Amount', 'ExpiryDate'];
        
        if($existing['Status'] == 'drop'){
            $allowedFields = ['DropReason'];
        }
        
        $changes = [];
        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== $existing[$field]) {
                $updateData[$field] = $data[$field];

                if($field == 'MakeID'){
                    $mk = Database::fetchAll("SELECT id, Name from makes where id IN(?,?)",[$existing[$field], $data[$field]]);
                    $from = array_filter($mk, function($item) use($existing, $field) { return $item['id'] == $existing[$field]; });
                    $to = array_filter($mk, function($item) use($data, $field) { return $item['id'] == $data[$field]; });

                    if($mk){
                        $changes[$field] = [
                            'from' => array_values($from),
                            'to' => array_values($to),
                        ];
                    }else{
                        $changes[$field] = [
                            'from' => $existing[$field],
                            'to' => $data[$field]
                        ];
                    }
                }else{
                    $changes[$field] = [
                        'from' => $existing[$field],
                        'to' => $data[$field]
                    ];
                }
            }
        }

        if (empty($updateData)) {
            $this->response(false, 'No fields to update', [], 400);
        }
        
        $updateData['UpdatedBy'] = $userID;
        $actionType = 'update';
        
        try {
            // Update franchise
            $rowCount = Database::update('franchises', $updateData, 'id = :id', ['id' => $id]);
            
            // Record in history
            if($rowCount > 0){
                $lastHistory = Database::fetch("SELECT * FROM franchise_history where FranchiseID = ? ORDER BY CreatedAt DESC LIMIT 1",[$id]);

                Database::insert('franchise_history', [
                    'FranchiseID' => $id,
                    'ActionType' => $actionType,
                    'PreviousStatus' => $lastHistory['PreviousStatus'],
                    'NewStatus' => $lastHistory['NewStatus'],
                    'DateIssued' => $data['DateIssued'] ?? $lastHistory['DateIssued'],
                    'ExpiryDate' => $data['ExpiryDate'] ?? $lastHistory['ExpiryDate'],
                    'Route' => $data['Route'] ?? $existing['Route'],
                    'PlateNo' => $data['PlateNo'] ?? $existing['PlateNo'],
                    'ORNo' => $data['ORNo'] ?? $existing['ORNo'],
                    'Amount' => $data['Amount'] ?? $existing['Amount'],
                    'DropReason' => $data['DropReason'] ?? $lastHistory['DropReason'],
                    'ChangesJson' => json_encode($changes),
                    'Remarks' => $data['Remarks'] ?? $lastHistory['Remarks'],
                    'CreatedBy' => $userID
                ]);
            }

            $franchise = $this->getFranchise($id);
            $histories = $this->getFranchiseHistories($id);
            
            if ($rowCount > 0 || !empty($changes)) {
                $this->response(true, 'Franchise updated successfully', [
                    'franchise' => $franchise,
                    'franchise_histories' => $histories
                ]);
            } else {
                $this->response(false, 'No changes made to franchise', [], 304);
            }
        } catch (Exception $e) {
            error_log('Franchise update error: ' . $e->getMessage());
            $this->response(false, 'Failed to update franchise', ['err' => $e->getMessage()], 500);
        }
    }
    
    // DELETE: Delete franchise
    public function delete(?string $id = null): void {
        $this->checkPermission(['Admin']);

        if (!$id) {
            $this->response(false, 'Franchise ID is required', [], 400);
        }

        try {
            // Make sure the franchise exists before deletion
            $franchise = Database::fetch("SELECT * FROM franchises WHERE id = ?", [$id]);
            if (!$franchise) {
                $this->response(false, 'Franchise not found', [], 404);
            }

            (new FranchiseDocumentService())->deleteAllDocuments((int)$id);

            // Perform deletion
            Database::query("DELETE FROM franchise_history WHERE FranchiseID = ?",[$id]);

            $stmt = Database::query("DELETE FROM franchises WHERE id = ?", [$id]);
            $rowCount = $stmt->rowCount();

            if ($rowCount > 0) {
                $this->LogDelete($franchise,'franchise');

                $this->response(true, 'Franchise deleted successfully');
            } else {
                $this->response(false, 'Franchise not found', [], 404);
            }
        } catch (Exception $e) {
            error_log('Franchise deletion error: ' . $e->getMessage());
            $this->response(false, 'Failed to delete franchise', ['err' => $e->getMessage()], 500);
        }
    }

    // GET: Statistics and reporting
    public function statistics($year): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        $yearCondition = $year > 0 ? "AND YEAR(lh.DateIssued) = ?" : "";
        $params = $year > 0 ? [$year] : [];
        
        // Total franchises by status from latest history only
        $statusStats = Database::fetchAll(
            "SELECT 
                lh.NewStatus as Status,
                COUNT(DISTINCT lh.FranchiseID) as count
            FROM franchise_history lh
            WHERE 1=1 $yearCondition
            GROUP BY lh.NewStatus",
            $params
        );
        
        // Franchises by route from franchises table with latest history
        $routeStats = Database::fetchAll(
            "SELECT 
                lh.Route,
                COUNT(DISTINCT lh.FranchiseID) as count
            FROM franchise_history lh
            WHERE 1=1 $yearCondition
            GROUP BY lh.Route
            ORDER BY count DESC",
            $params
        );
        
        // Franchises by make from franchises table with latest history
        $makeQuery = "SELECT 
                m.Name as make_name,
                COUNT(DISTINCT f.id) as count
            FROM makes m
            LEFT JOIN franchises f ON m.id = f.MakeID
            WHERE 1=1 $yearCondition
            GROUP BY m.id, m.Name
            ORDER BY count DESC";
        
        $makeStats = Database::fetchAll($makeQuery, $params);
        
        // Monthly breakdown - count actions/transactions in history
        $monthlyStats = [];
        if ($year > 0) {
            $monthlyStats = Database::fetchAll(
                "SELECT 
                    MONTH(fh.DateIssued) as month,
                    fh.ActionType,
                    COUNT(DISTINCT fh.FranchiseID) as count
                FROM franchise_history fh
                WHERE YEAR(fh.DateIssued) = ?
                GROUP BY MONTH(fh.DateIssued), fh.ActionType
                ORDER BY month, fh.ActionType",
                [$year]
            );
        } else {
            // Yearly breakdown - count actions/transactions in history
            $monthlyStats = Database::fetchAll(
                "SELECT 
                    YEAR(fh.DateIssued) as year,
                    fh.ActionType,
                    COUNT(DISTINCT fh.FranchiseID) as count
                FROM franchise_history fh
                GROUP BY YEAR(fh.DateIssued), fh.ActionType
                ORDER BY year DESC, fh.ActionType"
            );
        }
        
        // Total counts - unique franchises and transaction counts
        $totalsQuery = "SELECT 
                COUNT(DISTINCT CASE WHEN f.Status != 'drop' THEN f.id END) as total,
                COUNT(DISTINCT CASE WHEN f.Status = 'new' THEN f.id END) as new_count,
                COUNT(DISTINCT CASE WHEN lh.NewStatus = 'renew' THEN lh.FranchiseID END) as renew_count,
                COUNT(DISTINCT CASE WHEN f.Status = 'drop' THEN f.id END) as drop_count,
                COUNT(DISTINCT CASE WHEN (DATEDIFF(lh.ExpiryDate, CURDATE()) BETWEEN 0 AND 90) AND lh.NewStatus != 'drop' THEN lh.FranchiseID END) as expiring_soon
            FROM franchise_history lh
            INNER JOIN franchises f ON f.id = lh.FranchiseID
            WHERE 1=1 $yearCondition";
            
        $totals = Database::fetch($totalsQuery, $params);
        
        // Route breakdown by status from latest history only
        $routeStatusBreakdown = Database::fetchAll(
            "SELECT 
                f.Route,
                lh.NewStatus as Status,
                COUNT(DISTINCT f.id) as count
            FROM franchises f
            INNER JOIN franchise_history lh ON f.id = lh.FranchiseID
            WHERE 1=1 $yearCondition
            GROUP BY f.Route, lh.NewStatus
            ORDER BY f.Route, lh.NewStatus",
            $params
        );
        
        // Available years for filtering from history
        $availableYears = Database::fetchAll(
            "SELECT DISTINCT YEAR(DateIssued) as year 
            FROM franchise_history 
            WHERE YEAR(DateIssued) IS NOT NULL AND YEAR(DateIssued) > 0
            ORDER BY year DESC"
        );
        
        // Available routes for filtering from franchises table
        $availableRoutes = Database::fetchAll(
            "SELECT DISTINCT Route 
            FROM franchises 
            WHERE Route IS NOT NULL AND Route != ''
            ORDER BY Route ASC"
        );
        
        $this->response(true, 'Statistics retrieved successfully', [
            'year' => $year,
            'totals' => $totals,
            'by_status' => $statusStats,
            'by_route' => $routeStats,
            'by_make' => $makeStats,
            'monthly_breakdown' => $monthlyStats,
            'route_status_breakdown' => $routeStatusBreakdown,
            'available_years' => array_column($availableYears, 'year'),
            'available_routes' => array_column($availableRoutes, 'Route'),
        ]);
    }

    // GET: Get franchise history
    public function getHistory(?string $id = null): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        if (!$id) {
            $this->response(false, 'Franchise ID is required', [], 400);
        }
        
        $history = Database::fetchAll(
            "SELECT 
                fh.*,
                CONCAT(u.FirstName, ' ', u.LastName) as CreatedByName
            FROM franchise_history fh
            LEFT JOIN users u ON fh.CreatedBy = u.UserID
            WHERE fh.FranchiseID = ?
            ORDER BY fh.CreatedAt DESC",
            [$id]
        );
        
        // Parse ChangesJson for each record
        foreach ($history as &$record) {
            if ($record['ChangesJson']) {
                $record['Changes'] = json_decode($record['ChangesJson'], true);
            }
        }
        
        $this->response(true, 'Franchise history retrieved successfully', [
            'history' => $history,
            'total_records' => count($history)
        ]);
    }
    
    // POST: Renew franchise (dedicated endpoint)
    public function renew(?string $id = null): void {
        $this->checkPermission(['Admin', 'Editor']);
        
        if (!$id) {
            $this->response(false, 'Franchise ID is required', [], 400);
        }
        
        $data = $this->getJsonInput();
        
        // Validate required fields for renewal
        if (empty($data['ORNo']) || !isset($data['Amount'])) {
            $this->response(false, 'ORNo and Amount are required for renewal.', [], 400);
        }

        // Get current franchise
        $franchise = Database::fetch("SELECT * FROM franchises WHERE id = ?", [$id]);
        if (!$franchise) {
            $this->response(false, 'Franchise not found', [], 404);
        }
        
        $userID = $this->getAuthenticatedUser();
        $renewalDate = !empty($data['LastRenewalDate']) ? $data['LastRenewalDate'] : date('Y-m-d');
        $oldRoute = $franchise['Route'];
        
        try {
            // Update franchise
            $updateData = [
                'Status' => 'renew',
                'RenewalCount' => $franchise['RenewalCount'] + 1,
                'LastRenewalDate' => $renewalDate,
                'ORNo' => $data['ORNo'],
                'Amount' => $data['Amount'],
                'UpdatedBy' => $userID,
                'Route' => $data['Route'],
            ];
            
            // Optional: update expiry date
            if (!empty($data['ExpiryDate'])) {
                $updateData['ExpiryDate'] = $data['ExpiryDate'];
            }

            $changes = [
                'RenewalDate' => $renewalDate,
                'ExpiryDate' => $data['ExpiryDate'] ?? null,
                'ORNo' => $data['ORNo'],
                'Amount' => $data['Amount'],
            ];

            if($oldRoute !== $data['Route']){
                $changes['NewRoute'] = $data['Route'];
                $changes['OldRoute'] = $oldRoute;
            }
            
            Database::update('franchises', $updateData, 'id = :id', ['id' => $id]);
            
            // Record renewal in history
            Database::insert('franchise_history', [
                'FranchiseID' => $id,
                'ActionType' => 'renew',
                'PreviousStatus' => $franchise['Status'],
                'NewStatus' => 'renew',
                'DateIssued' => $renewalDate,
                'ExpiryDate' => $data['ExpiryDate'] ?? null,
                'Route' => $data['Route'],
                'PlateNo' => $franchise['PlateNo'],
                'ORNo' => $data['ORNo'],
                'Amount' => $data['Amount'],
                'Remarks' => $data['Remarks'] ?? 'Franchise renewed',
                'ChangesJson' => json_encode($changes),
                'CreatedBy' => $userID
            ]);

            $franchise = $this->getFranchise($id);
            $histories = $this->getFranchiseHistories($id);
            
            $this->response(true, 'Franchise renewed successfully', [
                'franchise' => $franchise,
                'franchise_histories' => $histories,
            ]);
        } catch (Exception $e) {
            error_log('Franchise renewal error: ' . $e->getMessage());
            $this->response(false, 'Failed to renew franchise', ['err' => $e->getMessage()], 500);
        }
    }

    // POST: Drop franchise (dedicated endpoint)
    public function drop(?string $id = null): void {
        $this->checkPermission(['Admin', 'Editor']);
        
        if (!$id) {
            $this->response(false, 'Franchise ID is required', [], 400);
        }
        
        $data = $this->getJsonInput();
        
        // Validate required fields for dropping
        if (empty($data['DropReason'])) {
            $this->response(false, 'DropReason is required to drop a franchise.', [], 400);
        }

        // Get current franchise
        $franchise = Database::fetch("SELECT * FROM franchises WHERE id = ?", [$id]);
        if (!$franchise) {
            $this->response(false, 'Franchise not found', [], 404);
        }
        
        $userID = $this->getAuthenticatedUser();
        
        try {
            // Update franchise status
            Database::update('franchises', [
                'Status' => 'drop',
                'DropReason' => $data['DropReason'],
                'UpdatedBy' => $userID
            ], 'id = :id', ['id' => $id]);

            $lastHistory = Database::fetch("SELECT * FROM franchise_history WHERE FranchiseID = ? AND ActionType IN('new','renew') ORDER BY CreatedAt DESC LIMIT 1", [$id]);
            
            // Record drop in history
            Database::insert('franchise_history', [
                'FranchiseID' => $id,
                'ActionType' => 'drop',
                'PreviousStatus' => $franchise['Status'],
                'NewStatus' => 'drop',
                'DateIssued' => $lastHistory['DateIssued'],
                'ExpiryDate' => $lastHistory['ExpiryDate'],
                'Route' => $lastHistory['Route'],
                'PlateNo' => $lastHistory['PlateNo'],
                'ORNo' => $lastHistory['ORNo'],
                'Amount' => $lastHistory['Amount'],
                'DropReason' => $data['DropReason'],
                'Remarks' => $data['Remarks'] ?? 'Franchise dropped',
                'CreatedBy' => $userID
            ]);

            $franchise = $this->getFranchise($id);
            $histories = $this->getFranchiseHistories($id);
            
            $this->response(true, 'Franchise dropped successfully', [
                'franchise' => $franchise,
                'franchise_histories' => $histories,
            ]);
        } catch (Exception $e) {
            error_log('Franchise drop error: ' . $e->getMessage());
            $this->response(false, 'Failed to drop franchise', ['err' => $e->getMessage()], 500);
        }
    }

    /**
     * GET: /api/franchises/{id}/export-form
     * Generates a PDF from an Excel template for a specific franchise.
     */
    
public function exportFranchiseForm(?string $id = null): void {

        $this->checkPermission(['Admin', 'Editor', 'Viewer']);

        if (!$id) {
            $this->response(false, 'Franchise ID is required.', [], 400);
            return;
        }

        $franchise = $this->getFranchise($id);
        if (!$franchise) {
            $this->response(false, 'Franchise not found.', [], 404);
            return;
        }

        $historyID = $_GET['history_id'] ?? '';

        if ($historyID !== '') {
            $lastHistory = Database::fetch(
                "SELECT * FROM franchise_history WHERE FranchiseID = ? AND id = ? LIMIT 1",
                [$id, $historyID]
            );
        } else {
            $lastHistory = Database::fetch(
                "SELECT * FROM franchise_history WHERE FranchiseID = ? AND NewStatus IN('new','renew') ORDER BY id DESC LIMIT 1",
                [$id]
            );
        }

        if (!$lastHistory) {
            $this->response(false, 'No franchise history found for PDF generation.', [], 404);
            return;
        }

        $franchiseNo = strtoupper((string)($franchise['FranchiseNo'] ?? ''));
        $dateIssued = !empty($lastHistory['DateIssued']) ? date('F j, Y', strtotime((string)$lastHistory['DateIssued'])) : '';
        $expiryDate = !empty($lastHistory['ExpiryDate']) ? date('F j, Y', strtotime((string)$lastHistory['ExpiryDate'])) : '';
        $applicantName = strtoupper((string)($franchise['ApplicantName'] ?? ''));
        $applicantGender = $this->normalizeGenderLabel($franchise['Gender'] ?? null);
        $address = strtoupper((string)($franchise['Address'] ?? ''));
        $route = strtoupper((string)($lastHistory['Route'] ?? ''));
        $make = strtoupper((string)($franchise['MakeName'] ?? ''));
        $engineNo = strtoupper((string)($franchise['EngineNo'] ?? ''));
        $chassisNo = strtoupper((string)($franchise['ChassisNo'] ?? ''));
        $plateNo = strtoupper((string)($franchise['PlateNo'] ?? ''));
        $orNo = strtoupper((string)($lastHistory['ORNo'] ?? ''));
        $amount = !empty($lastHistory['Amount']) ? 'PHP ' . number_format((float)$lastHistory['Amount'], 2) : '';

        if ($route === 'JUNCTION') {
            $route = 'Lubo junction of Zone II to Sawmill (Fong) junction in Zone IV';
        }

        $franchiseNoDisplay = $this->escapePdfValue($franchiseNo);
        $dateIssuedDisplay = $this->escapePdfValue($dateIssued);
        $expiryDateDisplay = $this->escapePdfValue($expiryDate);
        $applicantNameDisplay = $this->escapePdfValue($applicantName);
        $applicantGenderDisplay = $this->escapePdfValue($applicantGender);
        $addressDisplay = $this->escapePdfValue($address);
        $routeDisplay = $this->escapePdfValue($route);
        $makeDisplay = $this->escapePdfValue($make);
        $engineNoDisplay = $this->escapePdfValue($engineNo);
        $chassisNoDisplay = $this->escapePdfValue($chassisNo);
        $plateNoDisplay = $this->escapePdfValue($plateNo);
        $orNoDisplay = $this->escapePdfValue($orNo);
        $amountDisplay = $this->escapePdfValue($amount);

        try {
            $pdf = new \Mpdf\Mpdf([
                'mode' => 'utf-8',
                'format' => 'Legal-P',
                'margin_left' => 10,
                'margin_right' => 10,
                'margin_top' => 60,
                'margin_bottom' => 25,
                'margin_header' => 5,
                'margin_footer' => 10,
                'default_font' => 'arial',
                'setAutoTopMargin' => 'stretch',
                'autoMarginPadding' => 2,
            ]);

            $pdf->SetCreator('SB-FMS Application');
            $pdf->SetAuthor('SB-FMS');
            $pdf->SetTitle('Franchise Application Form');
            $pdf->SetSubject('Generated Franchise Application Form');
            $pdf->SetAutoPageBreak(true, 15);
            $pdf->SetHTMLHeader($this->buildFranchiseFormHeaderHtml());

            $pdf->WriteHTML('<h1 style="width:100%;text-align: right;line-height: 1.2;font-weight: bold;font-size:16pt;margin-top:5px;padding-right:7px;padding-left:5px;">
                MTOP-SBSC CASE NO. ' . $franchiseNoDisplay . '<br>
                <span style="width:100%;text-align: right;line-height: 0.5;font-weight: bold;font-size:14pt;">' . $dateIssuedDisplay . '</span>
            </h1>');

            $pdf->WriteHTML('<h1 style="width:100%;text-align: left;line-height: 1.1;font-weight: bold;font-size:16pt;">
                MOTORIZED TRICYCLE OPERATOR\'S PERMIT (MTOP)<br>
                <span style="width:100%;text-align: left;font-weight: bold;font-size:11pt;">(Authority to operate an MCH vehicle)</span>
            </h1>');

            $table = '
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;border-width:1px;">
                    <tr>
                        <td width="30%" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:11pt;text-align: left;">NAME OF APPLICANT</td>
                        <td width="45%" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:14pt;text-align: left;">' . $applicantNameDisplay . '</td>
                    </tr>
                    <tr>
                        <td width="30%" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:11pt;text-align: left;">ADDRESS</td>
                        <td width="70%" colspan="3" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:12pt;text-align: left;">' . $addressDisplay . '</td>
                    </tr>
                    <tr>
                        <td width="40%" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:10.5pt;text-align: left;">ROUTE / ZONE / AREA  OF OPERATION</td>
                        <td width="60%" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:11pt;text-align: left;">' . $routeDisplay . '</td>
                    </tr>
                    <tr>
                        <td width="40%" style="padding: 5px 10px;border: 1px solid #000;">&nbsp;</td>
                        <td width="60%" style="padding: 5px 10px;border: 1px solid #000;">&nbsp;</td>
                    </tr>
                </table>
            ';

            $pdf->WriteHTML($table);

            $pdf->WriteHTML('<p style="width:100%;text-align: left;line-height: 1;font-weight: normal;font-size:11pt;">&nbsp;&nbsp;&nbsp;&nbsp;
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Applicant is hereby authorized to operate an MCH vehicle for transportation of passengers in <br>
            the above specified route/zone/area of operation with the units describe hereunder, to wit:
            </p>');

            $table = '
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;border-width:1px;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid #000;background-color: #C4D79B;font-weight: bold; font-size: 11pt;text-align:center;padding:5px;">MAKE</th>
                            <th style="border: 1px solid #000;background-color: #C4D79B;font-weight: bold; font-size: 11pt;text-align:center;padding:5px;">ENGINE NO.</th>
                            <th style="border: 1px solid #000;background-color: #C4D79B;font-weight: bold; font-size: 11pt;text-align:center;padding:5px;">CHASSIS NO.</th>
                            <th style="border: 1px solid #000;background-color: #C4D79B;font-weight: bold; font-size: 11pt;text-align:center;padding:5px;">PLATE NO.</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #000;font-weight: bold;font-size:12pt;text-align: center;padding:5px;">' . $makeDisplay . '</td>
                            <td style="border: 1px solid #000;font-weight: bold;font-size:12pt;text-align: center;padding:5px;">' . $engineNoDisplay . '</td>
                            <td style="border: 1px solid #000;font-weight: bold;font-size:12pt;text-align: center;padding:5px;">' . $chassisNoDisplay . '</td>
                            <td style="border: 1px solid #000;font-weight: bold;font-size:12pt;text-align: center;padding:5px;">' . $plateNoDisplay . '</td>
                        </tr>
                    </tbody>
                </table>
            ';

            $pdf->WriteHTML($table);

            $pdf->WriteHTML('<p style="width:100%;text-align: left;line-height: 1;font-weight: normal;font-size:11pt;">Subject to the following conditions:</p>');

            $pdf->WriteHTML('<h1 style="width:100%;text-align: center;line-height: 1;font-weight: bold;font-size:14pt;">
                C O N D I T I O N S
            </h1>');

            $table = '
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;border-width:1px;">
                    <tr>
                        <td width="1%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">1.</td>
                        <td width="99%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">
                            Applicant shall comply to  the policies rules and regulations prescribed by this Section for MCH operation and with such orders, directives or guidelines as maybe promulgated from time to time.
                        </td>
                    </tr>
                    <tr>
                        <td width="1%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">2.</td>
                        <td width="99%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">
                            The unit/s herein  authorized shall be registered under the <strong>MCH  denomination</strong> with the <strong>LAND TRANSPORTATION OFFICE (LTO).</strong>
                        </td>
                    </tr>
                    <tr>
                        <td width="1%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">3.</td>
                        <td width="99%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">
                            The authority shall be valid for <strong style="color: #003366;text-decoration: underline;">FIVE (5) YEARS</strong> or <strong style="color: #003366;">until '. strtoupper($expiryDateDisplay) .'</strong> which is counted from the date of first issuance.
                        </td>
                    </tr>
                    <tr>
                        <td width="1%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">4.</td>
                        <td width="99%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">
                            Applicant  shall  not alter nor  change  any entry  on  this  Authority nor alter or change the color  scheme by the section for adoption in the route/zone/area of operation prescribe above.
                        </td>
                    </tr>
                    <tr>
                        <td width="1%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">5.</td>
                        <td width="99%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">
                            Applicant  shall  provisionaly  charge  and  collect  a minimum fare of P 8.00 per passenger per trip within the Poblacion, subdivision, route specified above.
                        </td>
                    </tr>
                    <tr>
                        <td width="1%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">6.</td>
                        <td width="99%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">
                            Applicant is authorized to traverse the national highway in as much as there is no alternative route in their specified route of operation provided, that the applicant shall utilize the outermost lane of the national highway and observe the prescribed speed limit.
                        </td>
                    </tr>
                    <tr>
                        <td width="1%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">7.</td>
                        <td width="99%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">
                            Failure  of  the  applicant  to comply  with the  foregoing  requirements  or with related rules and  regulations (MUNICIPAL ORDINANCE NO.03 series of 2008) shall be  considered as  sufficient  cause of cancellation or revocation of this authority.
                        </td>
                    </tr>
                    <tr>
                        <td width="1%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">&nbsp;</td>
                        <td width="99%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;padding:5px;vertical-align:top;">
                             ENTERED, Santa Cruz, Davao del Sur, Philippines.
                        </td>
                    </tr>
                </table>
            ';

            $pdf->WriteHTML($table);

            $table = '
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;border-width:1px;">
                    <tr><td width="50%">&nbsp;</td><td width="50%">&nbsp;</td></tr>
                    <tr>
                        <td width="50%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;">&nbsp;</td>
                        <td width="50%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;">Approved by:</td>
                    </tr>
                    <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                    <tr>
                        <td width="50%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;">&nbsp;</td>
                        <td width="50%" style="border: none;font-weight: bold;font-size:12pt;text-align: center;">Atty. CHARLOTTE FERNANDEZ GALLEGO</td>
                    </tr>
                    <tr>
                        <td width="50%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;">&nbsp;</td>
                        <td width="50%" style="border: none;font-weight: normal;font-size:11pt;text-align: center;">Municipal Vice-Mayor</td>
                    </tr>
                    <tr>
                        <td width="50%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;">&nbsp;</td>
                        <td width="50%" style="border: none;font-weight: normal;font-size:10pt;text-align: center;">Chairperson, Sta. Cruz Franchising and Regulatory Board</td>
                    </tr>
                </table>
            ';

            $pdf->WriteHTML($table);

            $table = '
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;border-width:1px;">
                    <tr>
                        <td width="50%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;border-width:1px;">
                                <tr>
                                    <td width="25%" style="border: none;font-weight: normal;font-size:8pt;text-align: left;">Paid under O.R. No</td>
                                    <td width="75%" style="padding-left:5px;border: none;font-weight: normal;font-size:8pt;text-align: left;">:&nbsp;' . $orNoDisplay . '</td>
                                </tr>
                                <tr>
                                    <td width="25%" style="border: none;font-weight: normal;font-size:8pt;text-align: left;">Amount</td>
                                    <td width="75%" style="padding-left:5px;border: none;font-weight: normal;font-size:8pt;text-align: left;">:&nbsp;' . $amountDisplay . '</td>
                                </tr>
                                <tr>
                                    <td width="25%" style="border: none;font-weight: normal;font-size:8pt;text-align: left;">Date</td>
                                    <td width="75%" style="padding-left:5px;border: none;font-weight: normal;font-size:8pt;text-align: left;">:&nbsp;' . $dateIssuedDisplay . '</td>
                                </tr>
                            </table>
                        </td>
                        <td width="50%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;">&nbsp;</td>
                    </tr>
                </table>
            ';

            $pdf->WriteHTML($table);
            $pdf->SetHTMLFooter('<div style="text-align: right; font-size: 10pt; font-weight: bold; padding: 5px 0;">Page {PAGENO} of {nbpg}</div>');

            $fileName = 'Franchise_Application_Form_' . $franchiseNo . '_' . date('Y-m-d-H-i-s') . '.pdf';
            $this->streamPdfOutput($pdf, $fileName);
        } catch (Exception $e) {
            error_log('exportFranchiseFormPDF error: ' . $e->getMessage());
            $this->response(false, 'PDF generation failed: ' . $e->getMessage(), [], 500);
            return;
        }
    }

    /**
     * GET: /api/franchises/export/pdf
     */
    public function exportPDF(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);

        $status = strtolower(trim((string)($_GET['status'] ?? 'all')));
        $reportTypeRaw = (string)($_GET['report_type'] ?? 'report');
        $reportType = $this->normalizeReportType($reportTypeRaw, $status);
        $window = $this->normalizeExpiringWindow((int)($_GET['window'] ?? $this->extractExpiringWindowFromReportType($reportTypeRaw)));
        $genderFilter = $this->normalizeGenderExportFilter($_GET['gender_filter'] ?? 'all');
        $startDate = $this->normalizeOptionalDate($_GET['start_date'] ?? null);
        $endDate = $this->normalizeOptionalDate($_GET['end_date'] ?? null);

        if ($this->reportRequiresDateRange($reportType) && (!$startDate || !$endDate)) {
            $this->response(false, 'Start date and end date are required for this PDF export.', [], 400);
            return;
        }

        if (!$startDate) {
            $endDate = null;
        }

        if ($startDate && $endDate && strtotime($endDate) < strtotime($startDate)) {
            $this->response(false, 'End date cannot be earlier than the start date.', [], 400);
            return;
        }

        try {
            switch ($reportType) {
                case 'summaryByRoute':
                    $rows = $this->filterRowsByGender($this->getFranchisesForRouteSummary((string)$startDate, (string)$endDate), $genderFilter);
                    $this->generateSummaryByRoutePDF($rows, (string)$startDate, (string)$endDate);
                    return;

                case 'activeHolders':
                    $rows = $this->filterRowsByGender($this->getActiveFranchisesForExport($startDate, $endDate), $genderFilter);
                    $this->generateFranchisePDF($rows, $startDate, $endDate, 'active', 'activeHolders');
                    return;

                case 'expiring':
                    $rows = $this->filterRowsByGender($this->getExpiringFranchisesForExport($window), $genderFilter);
                    $this->generateExpiringFranchisesPDF($rows, $window);
                    return;

                case 'droppedMasterlist':
                    $rows = $this->filterRowsByGender($this->getDroppedFranchisesForExport($startDate, $endDate), $genderFilter);
                    $this->generateDroppedMasterlistPDF($rows, $startDate, $endDate);
                    return;

                case 'perHolderSummary':
                    $rows = $this->filterRowsByGender($this->getPerHolderSummaryForExport($startDate, $endDate), $genderFilter);
                    $this->generatePerHolderSummaryPDF($rows, $startDate, $endDate);
                    return;

                case 'report':
                default:
                    $rows = $this->filterRowsByGender($this->getFranchisesForExport((string)$startDate, (string)$endDate, $status), $genderFilter);
                    $this->generateFranchisePDF($rows, (string)$startDate, (string)$endDate, $status, 'report');
                    return;
            }
        } catch (Exception $e) {
            error_log('PDF Export error: ' . $e->getMessage());
            $this->response(false, 'Failed to export PDF.', ['err' => $e->getMessage()], 500);
        }
    }


    public function exportExcel(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);

        $status = strtolower(trim((string)($_GET['status'] ?? 'all')));
        $reportTypeRaw = (string)($_GET['report_type'] ?? 'report');
        $reportType = $this->normalizeReportType($reportTypeRaw, $status);
        $window = $this->normalizeExpiringWindow((int)($_GET['window'] ?? $this->extractExpiringWindowFromReportType($reportTypeRaw)));
        $genderFilter = $this->normalizeGenderExportFilter($_GET['gender_filter'] ?? 'all');
        $startDate = $this->normalizeOptionalDate($_GET['start_date'] ?? null);
        $endDate = $this->normalizeOptionalDate($_GET['end_date'] ?? null);

        if ($this->reportRequiresDateRange($reportType) && (!$startDate || !$endDate)) {
            $this->response(false, 'Start date and end date are required for this Excel export.', [], 400);
            return;
        }

        if (!$startDate) {
            $endDate = null;
        }

        if ($startDate && $endDate && strtotime($endDate) < strtotime($startDate)) {
            $this->response(false, 'End date cannot be earlier than the start date.', [], 400);
            return;
        }

        try {
            switch ($reportType) {
                case 'summaryByRoute':
                    $rows = $this->filterRowsByGender($this->getFranchisesForRouteSummary((string)$startDate, (string)$endDate), $genderFilter);
                    $this->generateSummaryByRouteExcel($rows, (string)$startDate, (string)$endDate);
                    return;

                case 'activeHolders':
                    $rows = $this->filterRowsByGender($this->getActiveFranchisesForExport($startDate, $endDate), $genderFilter);
                    $this->generateFranchiseExcel($rows, $startDate, $endDate, 'active', 'activeHolders');
                    return;

                case 'expiring':
                    $rows = $this->filterRowsByGender($this->getExpiringFranchisesForExport($window), $genderFilter);
                    $this->generateExpiringFranchisesExcel($rows, $window);
                    return;

                case 'droppedMasterlist':
                    $rows = $this->filterRowsByGender($this->getDroppedFranchisesForExport($startDate, $endDate), $genderFilter);
                    $this->generateDroppedMasterlistExcel($rows, $startDate, $endDate);
                    return;

                case 'perHolderSummary':
                    $rows = $this->filterRowsByGender($this->getPerHolderSummaryForExport($startDate, $endDate), $genderFilter);
                    $this->generatePerHolderSummaryExcel($rows, $startDate, $endDate);
                    return;

                case 'report':
                default:
                    $rows = $this->filterRowsByGender($this->getFranchisesForExport((string)$startDate, (string)$endDate, $status), $genderFilter);
                    $this->generateFranchiseExcel($rows, (string)$startDate, (string)$endDate, $status, 'report');
                    return;
            }
        } catch (Exception $e) {
            error_log('Excel Export error: ' . $e->getMessage());
            $this->response(false, 'Failed to export Excel.', ['err' => $e->getMessage()], 500);
        }
    }

    /**
     * GET: /api/franchises/export/summary-by-route/pdf
     * Backward-compatible route for existing callers.
     */
    public function exportSummaryByRoutePDF(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);

        $startDate = $this->normalizeOptionalDate($_GET['start_date'] ?? null);
        $endDate = $this->normalizeOptionalDate($_GET['end_date'] ?? null);

        if (!$startDate || !$endDate) {
            $this->response(false, 'Start date and end date are required for route summary export.', [], 400);
            return;
        }

        if (strtotime($endDate) < strtotime($startDate)) {
            $this->response(false, 'End date cannot be earlier than the start date.', [], 400);
            return;
        }

        try {
            $rows = $this->getFranchisesForRouteSummary($startDate, $endDate);
            $this->generateSummaryByRoutePDF($rows, $startDate, $endDate);
        } catch (Exception $e) {
            error_log('Summary By Route PDF Export error: ' . $e->getMessage());
            $this->response(false, 'Failed to export summary by route PDF.', ['err' => $e->getMessage()], 500);
        }
    }

    private function normalizeReportType(string $reportType, string $status = 'all'): string {
        $normalized = strtolower(trim($reportType));

        if ($normalized === 'report' && $status === 'active') {
            return 'activeHolders';
        }

        return match ($normalized) {
            'report' => 'report',
            'summarybyroute' => 'summaryByRoute',
            'activeholders', 'activefranchiseholders', 'active' => 'activeHolders',
            'expiring', 'expiring30', 'expiring60', 'expiring90' => 'expiring',
            'droppedmasterlist', 'dropped', 'droppedlist' => 'droppedMasterlist',
            'perholdersummary', 'holdersummary' => 'perHolderSummary',
            default => 'report',
        };
    }

    private function extractExpiringWindowFromReportType(string $reportType): int {
        return match (strtolower(trim($reportType))) {
            'expiring60' => 60,
            'expiring90' => 90,
            default => 30,
        };
    }

    private function normalizeExpiringWindow(int $window): int {
        return in_array($window, [30, 60, 90], true) ? $window : 30;
    }

    private function normalizeOptionalDate(mixed $value): ?string {
        if ($value === null) {
            return null;
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        $value = trim((string)$value);
        if ($value === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return $value;
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return null;
        }

        return date('Y-m-d', $timestamp);
    }

    private function reportRequiresDateRange(string $reportType): bool {
        return in_array($reportType, ['report', 'summaryByRoute'], true);
    }

    private function buildOptionalDateRangeLabel(?string $startDate, ?string $endDate, string $allLabel = 'All'): string {
        if (!$startDate) {
            return $allLabel;
        }

        if (!$endDate || $startDate === $endDate) {
            return 'From ' . date('F j, Y', strtotime($startDate));
        }

        return date('F j, Y', strtotime($startDate)) . ' - ' . date('F j, Y', strtotime($endDate));
    }

    private function getApplicantNameSql(string $alias = 'a'): string {
        return "CONCAT({$alias}.LastName, ', ', {$alias}.FirstName, CASE WHEN COALESCE({$alias}.MiddleName, '') <> '' THEN CONCAT(' ', LEFT({$alias}.MiddleName, 1), '.') ELSE '' END)";
    }

    private function resolveAssetPath(string $relativePath): string {
        $normalized = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath);
        $candidates = [
            dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . $normalized,
            dirname(__DIR__) . DIRECTORY_SEPARATOR . $normalized,
            $normalized,
        ];

        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        throw new Exception('PDF generation failed: Required asset not found (' . $relativePath . ').');
    }

    private function getLatestHistorySubquery(): string {
        return "
            SELECT h1.id, h1.FranchiseID, h1.ActionType, h1.NewStatus, h1.DateIssued, h1.ExpiryDate, h1.Route, h1.ORNo, h1.Amount, h1.PlateNo, h1.DropReason, h1.CreatedAt
            FROM franchise_history h1
            INNER JOIN (
                SELECT FranchiseID, MAX(id) AS latest_id
                FROM franchise_history
                GROUP BY FranchiseID
            ) latest ON latest.latest_id = h1.id
        ";
    }

    private function getLatestActiveHistorySubquery(): string {
        return "
            SELECT h1.id, h1.FranchiseID, h1.DateIssued, h1.ExpiryDate, h1.Route, h1.ORNo, h1.Amount, h1.PlateNo, h1.CreatedAt
            FROM franchise_history h1
            INNER JOIN (
                SELECT FranchiseID, MAX(id) AS latest_id
                FROM franchise_history
                WHERE NewStatus IN ('new', 'renew')
                GROUP BY FranchiseID
            ) latest ON latest.latest_id = h1.id
        ";
    }

    private function getLatestDropHistorySubquery(): string {
        return "
            SELECT h1.id, h1.FranchiseID, h1.DateIssued, h1.ExpiryDate, h1.Route, h1.ORNo, h1.Amount, h1.PlateNo, h1.CreatedAt, h1.DropReason
            FROM franchise_history h1
            INNER JOIN (
                SELECT FranchiseID, MAX(id) AS latest_id
                FROM franchise_history
                WHERE NewStatus = 'drop'
                GROUP BY FranchiseID
            ) latest ON latest.latest_id = h1.id
        ";
    }

    private function getLatestDropHistoryWithinCoverageSubquery(bool $hasEndDate): string {
        $coverageSql = $hasEndDate
            ? "DATE(COALESCE(CreatedAt, DateIssued)) BETWEEN ? AND ?"
            : "DATE(COALESCE(CreatedAt, DateIssued)) >= ?";

        return "
            SELECT h1.id, h1.FranchiseID, h1.DateIssued, h1.ExpiryDate, h1.Route, h1.ORNo, h1.Amount, h1.PlateNo, h1.CreatedAt, h1.DropReason
            FROM franchise_history h1
            INNER JOIN (
                SELECT FranchiseID, MAX(id) AS latest_id
                FROM franchise_history
                WHERE NewStatus = 'drop'
                  AND {$coverageSql}
                GROUP BY FranchiseID
            ) latest ON latest.latest_id = h1.id
        ";
    }

    private function getFranchisesForRouteSummary(string $startDate, string $endDate): array {
        $nameSql = $this->getApplicantNameSql('a');

        $sql = "
            SELECT
                fh.id AS HistoryID,
                f.id AS FranchiseID,
                f.ApplicantID,
                COALESCE(NULLIF(fh.Route, ''), f.Route) AS Route,
                {$nameSql} AS Name,
                a.Gender,
                a.Address,
                f.FranchiseNo,
                COALESCE(NULLIF(fh.PlateNo, ''), f.PlateNo) AS PlateNo,
                m.Name AS MakeName,
                f.EngineNo,
                f.ChassisNo,
                fh.ORNo,
                fh.Amount,
                fh.DateIssued,
                fh.ExpiryDate,
                LOWER(COALESCE(fh.NewStatus, '')) AS Status
            FROM franchise_history fh
            JOIN franchises f ON fh.FranchiseID = f.id
            LEFT JOIN applicants a ON a.id = f.ApplicantID
            LEFT JOIN makes m ON f.MakeID = m.id
            WHERE fh.DateIssued BETWEEN ? AND ?
              AND LOWER(COALESCE(fh.NewStatus, '')) IN ('new', 'renew', 'drop')
            ORDER BY fh.id DESC
        ";

        $rows = Database::fetchAll($sql, [$startDate, $endDate]);
        $rows = $this->deduplicateCoverageRowsByLatestHistory($rows, false);
        $rows = array_values(array_filter($rows, static function (array $row): bool {
            $status = strtolower(trim((string)($row['Status'] ?? '')));
            return in_array($status, ['new', 'renew'], true);
        }));

        usort($rows, function (array $a, array $b): int {
            $routeA = strtoupper(trim((string)($a['Route'] ?? 'UNKNOWN')));
            $routeB = strtoupper(trim((string)($b['Route'] ?? 'UNKNOWN')));
            if ($routeA !== $routeB) {
                return strcmp($routeA, $routeB);
            }

            $nameA = (string)($a['Name'] ?? '');
            $nameB = (string)($b['Name'] ?? '');
            if ($nameA !== $nameB) {
                return strcmp($nameA, $nameB);
            }

            $franchiseNoA = (string)($a['FranchiseNo'] ?? '');
            $franchiseNoB = (string)($b['FranchiseNo'] ?? '');
            if ($franchiseNoA !== $franchiseNoB) {
                return strcmp($franchiseNoA, $franchiseNoB);
            }

            return $this->getComparableHistoryId($b) <=> $this->getComparableHistoryId($a);
        });

        return $rows;
    }

    private function getFranchisesForExport(string $startDate, string $endDate, string $statusFilter = 'all'): array {
        $nameSql = $this->getApplicantNameSql('a');

        $sql = "
            SELECT
                fh.id AS HistoryID,
                f.id AS FranchiseID,
                f.ApplicantID,
                f.FranchiseNo,
                f.Driver,
                {$nameSql} AS Name,
                a.Gender,
                a.Address,
                a.ContactNo,
                COALESCE(NULLIF(fh.PlateNo, ''), f.PlateNo) AS PlateNo,
                COALESCE(NULLIF(fh.Route, ''), f.Route) AS Route,
                fh.DateIssued,
                f.EngineNo,
                f.ChassisNo,
                fh.ExpiryDate,
                LOWER(COALESCE(fh.NewStatus, '')) AS Status,
                m.Name AS MakeName
            FROM franchise_history fh
            JOIN franchises f ON fh.FranchiseID = f.id
            LEFT JOIN applicants a ON a.id = f.ApplicantID
            LEFT JOIN makes m ON f.MakeID = m.id
            WHERE fh.DateIssued BETWEEN ? AND ?
              AND LOWER(COALESCE(fh.NewStatus, '')) IN ('new', 'renew', 'drop')
            ORDER BY fh.id DESC
        ";

        $rows = Database::fetchAll($sql, [$startDate, $endDate]);
        $rows = $this->deduplicateCoverageRowsByLatestHistory($rows, false);

        $today = date('Y-m-d');
        $statusFilter = strtolower(trim($statusFilter));

        $rows = array_values(array_filter($rows, static function (array $row) use ($statusFilter, $today): bool {
            $status = strtolower(trim((string)($row['Status'] ?? '')));
            $expiryDate = trim((string)($row['ExpiryDate'] ?? ''));
            $hasExpiry = ($expiryDate !== '' && $expiryDate !== '0000-00-00');

            return match ($statusFilter) {
                'new' => $status === 'new',
                'renew' => $status === 'renew',
                'drop' => $status === 'drop',
                'expired' => in_array($status, ['new', 'renew'], true) && $hasExpiry && $expiryDate < $today,
                'active' => in_array($status, ['new', 'renew'], true),
                default => in_array($status, ['new', 'renew', 'drop'], true),
            };
        }));

        usort($rows, function (array $a, array $b): int {
            $nameA = (string)($a['Name'] ?? '');
            $nameB = (string)($b['Name'] ?? '');
            if ($nameA !== $nameB) {
                return strcmp($nameA, $nameB);
            }

            $dateA = (string)($a['DateIssued'] ?? '');
            $dateB = (string)($b['DateIssued'] ?? '');
            if ($dateA !== $dateB) {
                return strcmp($dateA, $dateB);
            }

            $franchiseNoA = (string)($a['FranchiseNo'] ?? '');
            $franchiseNoB = (string)($b['FranchiseNo'] ?? '');
            return strcmp($franchiseNoA, $franchiseNoB);
        });

        return $rows;
    }

    private function getActiveFranchisesForExport(?string $startDate = null, ?string $endDate = null): array {
        $nameSql = $this->getApplicantNameSql('a');
        $latestHistorySql = $this->getLatestHistorySubquery();
        $activeHistorySql = $this->getLatestActiveHistorySubquery();

        $sql = "
            SELECT
                ah.id AS ActiveHistoryID,
                lh.id AS LatestHistoryID,
                f.id AS FranchiseID,
                f.ApplicantID,
                f.FranchiseNo,
                f.Driver,
                {$nameSql} AS Name,
                a.Gender,
                a.Address,
                a.ContactNo,
                COALESCE(NULLIF(ah.PlateNo, ''), NULLIF(lh.PlateNo, ''), f.PlateNo) AS PlateNo,
                COALESCE(NULLIF(ah.Route, ''), NULLIF(lh.Route, ''), f.Route) AS Route,
                ah.DateIssued,
                f.EngineNo,
                f.ChassisNo,
                ah.ExpiryDate,
                LOWER(COALESCE(lh.NewStatus, '')) AS Status,
                m.Name AS MakeName
            FROM franchises f
            INNER JOIN ({$latestHistorySql}) lh ON lh.FranchiseID = f.id
            INNER JOIN ({$activeHistorySql}) ah ON ah.FranchiseID = f.id
            LEFT JOIN applicants a ON a.id = f.ApplicantID
            LEFT JOIN makes m ON f.MakeID = m.id
            WHERE LOWER(COALESCE(lh.NewStatus, '')) IN ('new', 'renew')
              AND ah.ExpiryDate IS NOT NULL
              AND f.Driver IS NOT NULL
              AND ah.ExpiryDate <> '0000-00-00'
        ";

        $params = [];
        $today = date('Y-m-d');

        if ($startDate) {
            if ($endDate) {
                $sql .= " AND ah.ExpiryDate BETWEEN ? AND ?";
                $params[] = $startDate;
                $params[] = $endDate;
            } else {
                $sql .= " AND ah.ExpiryDate >= ?";
                $params[] = $startDate;
            }
        } else {
            $sql .= " AND ah.ExpiryDate >= ?";
            $params[] = $today;
        }

        $sql .= " ORDER BY {$nameSql} ASC, ah.ExpiryDate ASC, f.FranchiseNo ASC";

        $rows = Database::fetchAll($sql, $params);
        return $this->deduplicateFranchiseUnitRows($rows);
    }

    private function getDroppedFranchisesForExport(?string $startDate = null, ?string $endDate = null): array {
        $nameSql = $this->getApplicantNameSql('a');
        $activeHistorySql = $this->getLatestActiveHistorySubquery();

        if ($startDate) {
            $dropHistorySql = $this->getLatestDropHistoryWithinCoverageSubquery($endDate !== null);
            $dropHistoryParams = [$startDate];
            if ($endDate) {
                $dropHistoryParams[] = $endDate;
            }
        } else {
            $dropHistorySql = $this->getLatestDropHistorySubquery();
            $dropHistoryParams = [];
        }

        $sql = "
            SELECT
                dh.id AS HistoryID,
                f.id AS FranchiseID,
                f.ApplicantID,
                f.FranchiseNo,
                {$nameSql} AS Name,
                a.Gender,
                a.Address,
                a.ContactNo,
                COALESCE(NULLIF(dh.PlateNo, ''), NULLIF(ah.PlateNo, ''), f.PlateNo) AS PlateNo,
                COALESCE(NULLIF(dh.Route, ''), NULLIF(ah.Route, ''), f.Route) AS Route,
                ah.DateIssued,
                f.EngineNo,
                f.ChassisNo,
                ah.ExpiryDate,
                'drop' AS Status,
                m.Name AS MakeName,
                dh.DropReason,
                dh.CreatedAt AS DroppedAt
            FROM franchises f
            INNER JOIN ({$dropHistorySql}) dh ON dh.FranchiseID = f.id
            LEFT JOIN ({$activeHistorySql}) ah ON ah.FranchiseID = f.id
            LEFT JOIN applicants a ON a.id = f.ApplicantID
            LEFT JOIN makes m ON f.MakeID = m.id
            ORDER BY {$nameSql} ASC, dh.CreatedAt DESC, f.FranchiseNo ASC
        ";

        $rows = Database::fetchAll($sql, $dropHistoryParams);
        $rows = $this->deduplicateCoverageRowsByLatestHistory($rows, false);

        usort($rows, function (array $a, array $b): int {
            $nameA = (string)($a['Name'] ?? '');
            $nameB = (string)($b['Name'] ?? '');
            if ($nameA !== $nameB) {
                return strcmp($nameA, $nameB);
            }

            $droppedAtA = (string)($a['DroppedAt'] ?? '');
            $droppedAtB = (string)($b['DroppedAt'] ?? '');
            if ($droppedAtA !== $droppedAtB) {
                return strcmp($droppedAtB, $droppedAtA);
            }

            return strcmp((string)($a['FranchiseNo'] ?? ''), (string)($b['FranchiseNo'] ?? ''));
        });

        return $rows;
    }

    private function getExpiringFranchisesForExport(int $window): array {
        $nameSql = $this->getApplicantNameSql('a');
        $latestHistorySql = $this->getLatestHistorySubquery();
        $activeHistorySql = $this->getLatestActiveHistorySubquery();
        $today = date('Y-m-d');
        $windowEndDate = date('Y-m-d', strtotime('+' . $window . ' days'));

        $sql = "
            SELECT
                ah.id AS ActiveHistoryID,
                lh.id AS LatestHistoryID,
                f.id AS FranchiseID,
                f.ApplicantID,
                f.FranchiseNo,
                {$nameSql} AS Name,
                a.Gender,
                a.Address,
                a.ContactNo,
                COALESCE(NULLIF(ah.PlateNo, ''), NULLIF(lh.PlateNo, ''), f.PlateNo) AS PlateNo,
                COALESCE(NULLIF(ah.Route, ''), NULLIF(lh.Route, ''), f.Route) AS Route,
                ah.DateIssued,
                f.EngineNo,
                f.ChassisNo,
                ah.ExpiryDate,
                LOWER(COALESCE(lh.NewStatus, '')) AS Status,
                m.Name AS MakeName,
                DATEDIFF(ah.ExpiryDate, CURDATE()) AS DaysRemaining
            FROM franchises f
            INNER JOIN ({$latestHistorySql}) lh ON lh.FranchiseID = f.id
            INNER JOIN ({$activeHistorySql}) ah ON ah.FranchiseID = f.id
            LEFT JOIN applicants a ON a.id = f.ApplicantID
            LEFT JOIN makes m ON f.MakeID = m.id
            WHERE LOWER(COALESCE(lh.NewStatus, '')) IN ('new', 'renew')
              AND ah.ExpiryDate IS NOT NULL
              AND ah.ExpiryDate <> '0000-00-00'
              AND ah.ExpiryDate BETWEEN ? AND ?
            ORDER BY ah.ExpiryDate ASC, {$nameSql} ASC, f.FranchiseNo ASC
        ";

        $rows = Database::fetchAll($sql, [$today, $windowEndDate]);
        $rows = $this->deduplicateFranchiseUnitRows($rows);

        foreach ($rows as &$row) {
            $expiryDate = (string)($row['ExpiryDate'] ?? '');
            $row['DaysRemaining'] = ($expiryDate !== '' && $expiryDate !== '0000-00-00')
                ? (int)floor((strtotime($expiryDate) - strtotime($today)) / 86400)
                : null;
        }
        unset($row);

        usort($rows, function (array $a, array $b): int {
            $dateA = (string)($a['ExpiryDate'] ?? '9999-12-31');
            $dateB = (string)($b['ExpiryDate'] ?? '9999-12-31');
            if ($dateA !== $dateB) {
                return strcmp($dateA, $dateB);
            }

            $nameA = (string)($a['Name'] ?? '');
            $nameB = (string)($b['Name'] ?? '');
            if ($nameA !== $nameB) {
                return strcmp($nameA, $nameB);
            }

            return strcmp((string)($a['FranchiseNo'] ?? ''), (string)($b['FranchiseNo'] ?? ''));
        });

        return $rows;
    }

    private function getPerHolderSummaryForExport(?string $startDate = null, ?string $endDate = null): array {
        $nameSql = $this->getApplicantNameSql('a');
        $latestHistorySql = $this->getLatestHistorySubquery();
        $activeHistorySql = $this->getLatestActiveHistorySubquery();

        $sql = "
            SELECT
                ah.id AS ActiveHistoryID,
                lh.id AS LatestHistoryID,
                a.id AS ApplicantID,
                {$nameSql} AS Name,
                a.Gender,
                a.Address,
                a.ContactNo,
                f.id AS FranchiseID,
                f.FranchiseNo,
                COALESCE(NULLIF(ah.PlateNo, ''), NULLIF(lh.PlateNo, ''), f.PlateNo) AS PlateNo,
                COALESCE(NULLIF(ah.Route, ''), NULLIF(lh.Route, ''), f.Route) AS Route,
                f.ChassisNo,
                f.EngineNo,
                ah.DateIssued,
                ah.ExpiryDate
            FROM franchises f
            INNER JOIN applicants a ON a.id = f.ApplicantID
            INNER JOIN ({$latestHistorySql}) lh ON lh.FranchiseID = f.id
            INNER JOIN ({$activeHistorySql}) ah ON ah.FranchiseID = f.id
            WHERE LOWER(COALESCE(lh.NewStatus, '')) IN ('new', 'renew')
              AND ah.ExpiryDate IS NOT NULL
              AND ah.ExpiryDate <> '0000-00-00'
        ";

        $params = [];

        if ($startDate) {
            if ($endDate) {
                $sql .= " AND ah.ExpiryDate BETWEEN ? AND ?";
                $params[] = $startDate;
                $params[] = $endDate;
            } else {
                $sql .= " AND ah.ExpiryDate >= ?";
                $params[] = $startDate;
            }
        }

        $sql .= " ORDER BY {$nameSql} ASC, ah.ExpiryDate ASC, f.FranchiseNo ASC";

        $rows = Database::fetchAll($sql, $params);
        $rows = $this->deduplicateFranchiseUnitRows($rows);

        $grouped = [];
        foreach ($rows as $row) {
            $applicantId = (string)($row['ApplicantID'] ?? '');
            if ($applicantId === '') {
                continue;
            }

            if (!isset($grouped[$applicantId])) {
                $grouped[$applicantId] = [
                    'ApplicantID' => $row['ApplicantID'],
                    'Name' => $row['Name'] ?? '',
                    'Gender' => $this->normalizeGenderLabel($row['Gender'] ?? null),
                    'Address' => $row['Address'] ?? '',
                    'ContactNo' => $row['ContactNo'] ?? '',
                    'ActiveUnitCount' => 0,
                    'FranchiseNos' => [],
                    'PlateNos' => [],
                    'Routes' => [],
                    'NearestExpiryDate' => null,
                ];
            }

            $grouped[$applicantId]['ActiveUnitCount']++;

            $franchiseNo = trim((string)($row['FranchiseNo'] ?? ''));
            if ($franchiseNo !== '') {
                $grouped[$applicantId]['FranchiseNos'][$franchiseNo] = $franchiseNo;
            }

            $plateNo = trim((string)($row['PlateNo'] ?? ''));
            if ($plateNo !== '') {
                $grouped[$applicantId]['PlateNos'][$plateNo] = $plateNo;
            }

            $route = trim((string)($row['Route'] ?? ''));
            if ($route !== '') {
                $grouped[$applicantId]['Routes'][$route] = $route;
            }

            $expiryDate = trim((string)($row['ExpiryDate'] ?? ''));
            if ($expiryDate !== '' && $expiryDate !== '0000-00-00') {
                if ($grouped[$applicantId]['NearestExpiryDate'] === null || strcmp($expiryDate, (string)$grouped[$applicantId]['NearestExpiryDate']) < 0) {
                    $grouped[$applicantId]['NearestExpiryDate'] = $expiryDate;
                }
            }
        }

        $result = array_values(array_map(function (array $item): array {
            ksort($item['FranchiseNos']);
            ksort($item['PlateNos']);
            ksort($item['Routes']);

            return [
                'ApplicantID' => $item['ApplicantID'],
                'Name' => $item['Name'],
                'Gender' => $item['Gender'],
                'Address' => $item['Address'],
                'ContactNo' => $item['ContactNo'],
                'ActiveUnitCount' => $item['ActiveUnitCount'],
                'FranchiseNos' => implode(', ', array_values($item['FranchiseNos'])),
                'PlateNos' => implode(', ', array_values($item['PlateNos'])),
                'Routes' => implode(', ', array_values($item['Routes'])),
                'NearestExpiryDate' => $item['NearestExpiryDate'],
            ];
        }, $grouped));

        usort($result, function (array $a, array $b): int {
            $nameA = (string)($a['Name'] ?? '');
            $nameB = (string)($b['Name'] ?? '');
            return strcmp($nameA, $nameB);
        });

        return $result;
    }


    private function normalizeGenderExportFilter(mixed $gender): string {
        $value = strtoupper(trim((string)($gender ?? 'all')));

        return match ($value) {
            'M', 'MALE' => 'M',
            'F', 'FEMALE' => 'F',
            default => 'all',
        };
    }

    private function filterRowsByGender(array $rows, string $genderFilter = 'all'): array {
        $normalizedFilter = $this->normalizeGenderExportFilter($genderFilter);
        if ($normalizedFilter === 'all') {
            return $rows;
        }

        return array_values(array_filter($rows, function (array $row) use ($normalizedFilter): bool {
            return $this->normalizeGenderLabel($row['Gender'] ?? null) === $normalizedFilter;
        }));
    }

    private function buildOperatorCellHtml(array $item): string {
        $name = trim((string)($item['Name'] ?? ''));
        $driver = trim((string)($item['Driver'] ?? ''));

        $html = $this->escapePdfValue($driver !== '' ? $driver : '');
        if ($name !== '') {
            $html .= '<br><span style="font-size: 9px;">(Operator: ' . $this->escapePdfValue($name) . ')</span>';
        }

        return $html;
    }

    private function normalizeGenderLabel(mixed $gender): string {
        $value = strtoupper(trim((string)($gender ?? '')));

        return match ($value) {
            'M' => 'M',
            'F' => 'F',
            default => '',
        };
    }

    private function calculateGenderCounts(array $rows, bool $uniqueByApplicant = true): array {
        $counts = ['male' => 0, 'female' => 0];
        $seenApplicants = [];

        foreach ($rows as $row) {
            if ($uniqueByApplicant) {
                $applicantId = trim((string)($row['ApplicantID'] ?? ''));
                if ($applicantId !== '') {
                    if (isset($seenApplicants[$applicantId])) {
                        continue;
                    }

                    $seenApplicants[$applicantId] = true;
                }
            }

            $gender = $this->normalizeGenderLabel($row['Gender'] ?? null);

            if ($gender === 'M') {
                $counts['male']++;
            } elseif ($gender === 'F') {
                $counts['female']++;
            }
        }

        return $counts;
    }

    private function buildGenderSummaryText(array $rows, bool $uniqueByApplicant = true, string $labelPrefix = 'Franchise Holder By Gender'): string {
        $counts = $this->calculateGenderCounts($rows, $uniqueByApplicant);
        $parts = [];

        if ($counts['male'] > 0) {
            $parts[] = ' M(' . $counts['male'].')';
        }

        if ($counts['female'] > 0) {
            $parts[] = ' F(' . $counts['female'].')';
        }

        return $parts ? $labelPrefix.': ' . implode(' | ', $parts) : '';
    }

    private function formatStatusLabel(string $rawStatus, ?string $expiryDate = null, bool $considerExpired = true): string {
        $status = strtolower(trim($rawStatus));
        $today = strtotime(date('Y-m-d'));

        if (
            $considerExpired
            && in_array($status, ['new', 'renew'], true)
            && !empty($expiryDate)
            && $expiryDate !== '0000-00-00'
            && strtotime($expiryDate) < $today
        ) {
            return 'EXPIRED';
        }

        return match ($status) {
            'new' => 'NEW',
            'renew' => 'RENEWED',
            'drop' => 'DROPPED',
            default => strtoupper($status ?: 'N/A'),
        };
    }

    private function createPdfDocument(string $title, string $subject, string $format = 'Legal-L'): \Mpdf\Mpdf {
        $pdf = new \Mpdf\Mpdf([
            'mode' => 'utf-8',
            'format' => $format,
            'margin_left' => 5,
            'margin_right' => 5,
            'margin_top' => 35,
            'margin_bottom' => 15,
            'margin_header' => 5,
            'margin_footer' => 5,
        ]);

        $pdf->SetCreator('SB-FMS Application');
        $pdf->SetAuthor('SB-FMS');
        $pdf->SetTitle($title);
        $pdf->SetSubject($subject);
        $pdf->SetAutoPageBreak(true, 15);
        $pdf->SetHTMLHeader($this->buildPdfHeaderHtml());
        $pdf->SetHTMLFooter('<div style="text-align: right; font-size: 10pt; font-weight: bold; padding: 5px 0;">Page {PAGENO} of {nbpg}</div>');

        return $pdf;
    }

    private function buildPdfHeaderHtml(): string {
        $leftLogo = base64_encode((string)file_get_contents($this->resolveAssetPath('storage/images/left.jpg')));
        $rightLogo = base64_encode((string)file_get_contents($this->resolveAssetPath('storage/images/right.jpg')));

        return '
            <table width="100%" style="font-family: calibri; vertical-align: middle; text-align: center; border-collapse: collapse;" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td style="width: 20%; text-align: left; border:0 !important;"><img src="data:image/jpg;base64,' . $leftLogo . '" width="70" /></td>
                    <td style="width: 60%; text-align: center; border:0 !important;">
                        <div style="font-size: 9pt; line-height: 1.2;">REPUBLIC OF THE PHILIPPINES</div>
                        <div style="font-size: 11pt; font-weight: bold; line-height: 1.2;">PROVINCE OF DAVAO DEL SUR</div>
                        <div style="font-size: 16pt; font-weight: bold; line-height: 1.2;">MUNICIPALITY OF SANTA CRUZ</div>
                    </td>
                    <td style="width: 20%; text-align: right; border:0 !important;"><img src="data:image/jpg;base64,' . $rightLogo . '" width="70" /></td>
                </tr>
            </table>
            <hr style="margin: 5px 0 10px 0;" />';
    }

    private function buildFranchiseFormHeaderHtml(): string {
        $headerPath = $this->resolveFirstExistingAssetPath([
            'storage/images/template-header.jpg',
            'storage/images/template-header.jpeg',
            'storage/images/template-header.png',
            'storage/images/template_header.jpg',
            'storage/images/template_header.jpeg',
            'storage/images/template_header.png',
        ]);

        $headerUri = $this->toPdfFileUri($headerPath);

        return '
            <div style="width: 100%; margin: 0; padding: 0; text-align: left;">
                <img src="' . $this->escapePdfValue($headerUri) . '" style="display: block; width: 100%; height: auto; margin: 0; padding: 0;" />
            </div>
        ';
    }

    private function resolveFirstExistingAssetPath(array $relativePaths): string {
        foreach ($relativePaths as $relativePath) {
            try {
                return $this->resolveAssetPath($relativePath);
            } catch (Exception) {
                continue;
            }
        }

        throw new Exception('PDF generation failed: Required franchise form header asset not found.');
    }

    private function toPdfFileUri(string $path): string {
        $normalized = str_replace('\\', '/', $path);

        if (preg_match('/^[A-Za-z]:\//', $normalized) === 1) {
            return 'file:///' . $normalized;
        }

        if (str_starts_with($normalized, '/')) {
            return 'file://' . $normalized;
        }

        return $normalized;
    }

    private function getPdfDisposition(): array {
        $disposition = strtolower((string)($_GET['disposition'] ?? 'download'));

        if (in_array($disposition, ['inline', 'open', 'view', 'print'], true)) {
            return ['I', 'inline'];
        }

        return ['D', 'attachment'];
    }

    private function buildDateRangeLabel(string $startDate, string $endDate): string {
        return ($startDate === $endDate)
            ? 'On ' . date('F j, Y', strtotime($startDate))
            : date('F j, Y', strtotime($startDate)) . ' - ' . date('F j, Y', strtotime($endDate));
    }


    private function getSharedReportStyles(): string {
        return '
            <style>
                .report-title { text-align:center; font-weight:bold; font-size:13pt; margin:0; }
                .subtitle { text-align:center; font-size:9pt; margin:0 0 2px 0; }
                .meta { text-align:center; font-size:9pt; margin:0 0 10px 0; }
                .section-title { font-weight:bold; font-size:10pt; margin:10px 0 6px 0; }
                .route { font-weight:bold; font-size:11pt; margin:12px 0 6px 0; }
                .totals { margin-top:6px; font-size:9pt; }
                table { width:100%; border-collapse:collapse; font-family:calibri; font-size:8pt; }
                th, td { border:1px solid #ddd; padding:4px; vertical-align:top; }
                th { background:#f3f3f3; font-weight:bold; text-align:center; }
                .overall-table th, .overall-table td { font-size:9pt; }
                .overall-table td { text-align:center; }
                .overall-table td.route-name { text-align:left; font-weight:bold; }
                .grand-row td { font-weight:bold; background:#fafafa; }
            </style>
        ';
    }

    private function escapePdfValue(mixed $value): string {
        return htmlspecialchars((string)($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private function streamPdfOutput(\Mpdf\Mpdf $pdf, string $fileName): void {
        [$outputMode, $contentDisposition] = $this->getPdfDisposition();

        if (function_exists('ob_get_level')) {
            while (ob_get_level() > 0) {
                $buffer = (string)(ob_get_contents() ?: '');
                @ob_end_clean();

                if (trim($buffer) !== '') {
                    error_log('Discarded buffered output before PDF stream in ' . __METHOD__ . ': ' . substr($buffer, 0, 500));
                }
            }
        }

        if (!headers_sent()) {
            header('Content-Type: application/pdf');
            header('Content-Disposition: ' . $contentDisposition . '; filename="' . $fileName . '"');
            header('Cache-Control: private, max-age=0, must-revalidate');
            header('Pragma: public');
        }

        $pdf->Output($fileName, $outputMode);
        exit;
    }

    private function writeHtmlChunks(\Mpdf\Mpdf $pdf, array $chunks): void {
        foreach ($chunks as $chunk) {
            if ($chunk === null) {
                continue;
            }

            $chunk = (string)$chunk;
            if ($chunk === '') {
                continue;
            }

            $pdf->WriteHTML($chunk);
        }
    }

    private function writeTableRowsInChunks(\Mpdf\Mpdf $pdf, array $rowsHtml, int $rowsPerChunk = 100): void {
        if (empty($rowsHtml)) {
            return;
        }

        foreach (array_chunk($rowsHtml, max(1, $rowsPerChunk)) as $chunk) {
            $pdf->WriteHTML(implode('', $chunk));
        }
    }


    private function buildDistinctFranchiseUnitKey(array $row, bool $includePlate = true): string {
        $parts = [
            (string)($row['ApplicantID'] ?? ''),
            strtoupper(trim((string)($row['FranchiseNo'] ?? ''))),
            strtoupper(trim((string)($row['ChassisNo'] ?? ''))),
            strtoupper(trim((string)($row['EngineNo'] ?? ''))),
        ];

        if ($includePlate) {
            $parts[] = strtoupper(trim((string)($row['PlateNo'] ?? '')));
        }

        return implode('|', $parts);
    }

    private function getComparableHistoryId(array $row): int {
        return (int)($row['HistoryID'] ?? $row['ActiveHistoryID'] ?? $row['LatestHistoryID'] ?? $row['FranchiseID'] ?? 0);
    }

    private function isCandidateNewerByHistory(array $current, array $candidate): bool {
        $currentHistoryId = $this->getComparableHistoryId($current);
        $candidateHistoryId = $this->getComparableHistoryId($candidate);

        if ($candidateHistoryId !== $currentHistoryId) {
            return $candidateHistoryId > $currentHistoryId;
        }

        $currentIssued = (string)($current['DateIssued'] ?? '');
        $candidateIssued = (string)($candidate['DateIssued'] ?? '');
        if ($candidateIssued !== $currentIssued) {
            return strcmp($candidateIssued, $currentIssued) > 0;
        }

        $currentDroppedAt = (string)($current['DroppedAt'] ?? '');
        $candidateDroppedAt = (string)($candidate['DroppedAt'] ?? '');
        if ($candidateDroppedAt !== $currentDroppedAt) {
            return strcmp($candidateDroppedAt, $currentDroppedAt) > 0;
        }

        return false;
    }

    private function deduplicateCoverageRowsByLatestHistory(array $rows, bool $includePlate = false): array {
        $unique = [];

        foreach ($rows as $row) {
            $key = $this->buildDistinctFranchiseUnitKey($row, $includePlate);
            if (!isset($unique[$key])) {
                $unique[$key] = $row;
                continue;
            }

            if ($this->isCandidateNewerByHistory($unique[$key], $row)) {
                $unique[$key] = $row;
            }
        }

        return array_values($unique);
    }

    private function compareFranchiseUnitRows(array $current, array $candidate): int {
        $currentExpiry = (string)($current['ExpiryDate'] ?? '');
        $candidateExpiry = (string)($candidate['ExpiryDate'] ?? '');
        $currentExpiry = ($currentExpiry === '' || $currentExpiry === '0000-00-00') ? '0000-00-00' : $currentExpiry;
        $candidateExpiry = ($candidateExpiry === '' || $candidateExpiry === '0000-00-00') ? '0000-00-00' : $candidateExpiry;

        if ($candidateExpiry !== $currentExpiry) {
            return strcmp($candidateExpiry, $currentExpiry);
        }

        $currentIssued = (string)($current['DateIssued'] ?? '');
        $candidateIssued = (string)($candidate['DateIssued'] ?? '');
        if ($candidateIssued !== $currentIssued) {
            return strcmp($candidateIssued, $currentIssued);
        }

        $currentHistoryId = $this->getComparableHistoryId($current);
        $candidateHistoryId = $this->getComparableHistoryId($candidate);

        return $candidateHistoryId <=> $currentHistoryId;
    }

    private function deduplicateFranchiseUnitRows(array $rows): array {
        $unique = [];

        foreach ($rows as $row) {
            $key = $this->buildDistinctFranchiseUnitKey($row, true);
            if (!isset($unique[$key])) {
                $unique[$key] = $row;
                continue;
            }

            if ($this->compareFranchiseUnitRows($unique[$key], $row) > 0) {
                $unique[$key] = $row;
            }
        }

        return array_values($unique);
    }



    private function generateFranchisePDF(array $franchises, ?string $startDate, ?string $endDate, string $statusFilter = 'all', string $reportType = 'report'): void {
        $isActiveReport = ($reportType === 'activeHolders');
        $title = $isActiveReport ? 'ACTIVE FRANCHISE REPORT' : 'MTOP FRANCHISE REPORT';
        $activeReportStartDate = $isActiveReport
            ? ($startDate ?: date('Y-m-d'))
            : null;
        $dateFilterLabel = $isActiveReport
            ? $this->buildOptionalDateRangeLabel($activeReportStartDate, $endDate, 'From ' . date('F j, Y'))
            : $this->buildDateRangeLabel((string)$startDate, (string)$endDate);
        $subtitle = $isActiveReport
            ? 'Franchise records filtered using franchise expiry date'
            : $dateFilterLabel;
        $filterLabel = $isActiveReport
            ? 'ACTIVE / EXPIRY DATE FILTER'
            : match ($statusFilter) {
                'drop' => 'DROPPED',
                'renew' => 'RENEW',
                'new' => 'NEW',
                'expired' => 'EXPIRED',
                default => 'ALL',
            };

        $pdf = $this->createPdfDocument($title, 'Generated Franchise Report');

        $genderSummary = $this->buildGenderSummaryText($franchises, true);

        $this->writeHtmlChunks($pdf, [
            $this->getSharedReportStyles(),
            '<p class="report-title">' . $this->escapePdfValue($title) . '</p>',
            '<p class="subtitle">' . $this->escapePdfValue($subtitle) . '</p>',
            '<p class="meta">Status Filter: ' . $this->escapePdfValue($filterLabel) . ' | Date Filter: ' . $this->escapePdfValue($dateFilterLabel) . ' | Total Records: ' . count($franchises). ' | ' . $genderSummary . '</p>',
            '<table><thead><tr>
                <th style="width:3%;">#</th>
                <th style="width:12%;">DRIVER (OPERATOR)</th>
                <th style="width:12%;">ADDRESS</th>
                <th style="width:8%;">FRANCHISE NO.</th>
                <th style="width:7%;">DATE ISSUED</th>
                <th style="width:9%;">ROUTE</th>
                <th style="width:7%;">MAKE</th>
                <th style="width:8%;">ENGINE NO.</th>
                <th style="width:8%;">CHASSIS NO.</th>
                <th style="width:7%;">PLATE NO.</th>
            </tr></thead><tbody>',
        ]);
                // after operator: <th style="width:4%;">GENDER</th>
                // after date issued: <th style="width:7%;">EXPIRY DATE</th>
                // after plate number: <th style="width:6%;">STATUS</th>

        if (empty($franchises)) {
            $pdf->WriteHTML('<tr><td colspan="13" style="text-align:center;">No franchise records found for the selected filter.</td></tr>');
        } else {
            $rowHtml = [];
            foreach ($franchises as $index => $item) {
                $rowHtml[] = '<tr>
                    <td style="text-align:center;">' . ($index + 1) . '</td>
                    <td>' . $this->buildOperatorCellHtml($item) . '</td>
                    <td>' . $this->escapePdfValue(strtoupper((string)($item['Address'] ?? ''))) . '</td>
                    <td style="text-align:center;"><strong>' . $this->escapePdfValue((string)($item['FranchiseNo'] ?? '')) . '</strong></td>
                    <td style="text-align:center;">' . $this->escapePdfValue((string)($item['DateIssued'] ?? '')) . '</td>
                    <td>' . $this->escapePdfValue(strtoupper((string)($item['Route'] ?? ''))) . '</td>
                    <td>' . $this->escapePdfValue(strtoupper((string)($item['MakeName'] ?? ''))) . '</td>
                    <td>' . $this->escapePdfValue(strtoupper((string)($item['EngineNo'] ?? ''))) . '</td>
                    <td>' . $this->escapePdfValue(strtoupper((string)($item['ChassisNo'] ?? ''))) . '</td>
                    <td>' . $this->escapePdfValue(strtoupper((string)($item['PlateNo'] ?? ''))) . '</td>
                </tr>';
            }
                    // <td style="text-align:center;">' . $this->escapePdfValue($this->normalizeGenderLabel($item['Gender'] ?? null)) . '</td>
                    // <td style="text-align:center;">' . $this->escapePdfValue((string)(($item['ExpiryDate'] ?? '') === '0000-00-00' ? '' : ($item['ExpiryDate'] ?? ''))) . '</td>
                    // <td style="text-align:center;">' . $this->escapePdfValue($this->formatStatusLabel((string)($item['Status'] ?? ''), $item['ExpiryDate'] ?? null, true)) . '</td>

            $this->writeTableRowsInChunks($pdf, $rowHtml, 100);
        }

        $pdf->WriteHTML('</tbody></table>');

        $filePrefix = $isActiveReport ? 'Active_Franchise_Holders_Report_' : 'Franchise_Report_';
        $fileName = $filePrefix . date('Y-m-d-H-i-s') . '.pdf';

        $this->streamPdfOutput($pdf, $fileName);
    }



    private function generateExpiringFranchisesPDF(array $rows, int $window): void {
        $title = 'FRANCHISES EXPIRING WITHIN ' . $window . ' DAYS';
        $subtitle = 'Current active franchise units expiring between ' . date('F j, Y') . ' and ' . date('F j, Y', strtotime('+' . $window . ' days'));
        $pdf = $this->createPdfDocument($title, 'Generated Expiring Franchises Report');

        $genderSummary = $this->buildGenderSummaryText($rows, true);

        $this->writeHtmlChunks($pdf, [
            $this->getSharedReportStyles(),
            '<p class="report-title">' . htmlspecialchars($title) . '</p>',
            '<p class="subtitle">' . htmlspecialchars($subtitle) . '</p>',
            '<p class="meta">Total Records: ' . count($rows) . ' | '. $this->escapePdfValue($genderSummary) . '</p>',
            '<table><thead><tr>
                <th style="width:3%;">#</th>
                <th style="width:13%;">OPERATOR</th>
                <th style="width:5%;">GENDER</th>
                <th style="width:13%;">ADDRESS</th>
                <th style="width:8%;">FRANCHISE NO.</th>
                <th style="width:8%;">EXPIRY DATE</th>
                <th style="width:6%;">DAYS LEFT</th>
                <th style="width:10%;">ROUTE</th>
                <th style="width:7%;">MAKE</th>
                <th style="width:7%;">PLATE NO.</th>
                <th style="width:7%;">STATUS</th>
            </tr></thead><tbody>',
        ]);

        $rowHtml = [];
        foreach ($rows as $index => $item) {
            $rowHtml[] = '<tr>
                <td style="text-align:center;">' . ($index + 1) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['Name'] ?? ''))) . '</td>
                <td style="text-align:center;">' . htmlspecialchars($this->normalizeGenderLabel($item['Gender'] ?? null)) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['Address'] ?? ''))) . '</td>
                <td style="text-align:center;"><strong>' . htmlspecialchars((string)($item['FranchiseNo'] ?? '')) . '</strong></td>
                <td style="text-align:center;">' . htmlspecialchars((string)($item['ExpiryDate'] ?? '')) . '</td>
                <td style="text-align:center;">' . (int)($item['DaysRemaining'] ?? 0) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['Route'] ?? ''))) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['MakeName'] ?? ''))) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['PlateNo'] ?? ''))) . '</td>
                <td style="text-align:center;">' . htmlspecialchars($this->formatStatusLabel((string)($item['Status'] ?? ''), $item['ExpiryDate'] ?? null, false)) . '</td>
            </tr>';
        }

        $this->writeTableRowsInChunks($pdf, $rowHtml, 100);
        $pdf->WriteHTML('</tbody></table>');

        [$outputMode, $contentDisposition] = $this->getPdfDisposition();
        $fileName = 'Franchises_Expiring_Within_' . $window . '_Days_' . date('Y-m-d-H-i-s') . '.pdf';

        header('Content-Type: application/pdf');
        header('Content-Disposition: ' . $contentDisposition . '; filename="' . $fileName . '"');
        header('Cache-Control: private, max-age=0, must-revalidate');
        header('Pragma: public');

        $pdf->Output($fileName, $outputMode);
        exit;
    }



    private function generateDroppedMasterlistPDF(array $rows, ?string $startDate = null, ?string $endDate = null): void {
        $title = 'DROPPED FRANCHISE MASTERLIST';
        $subtitle = 'Date Filter: ' . $this->buildOptionalDateRangeLabel($startDate, $endDate, 'All');
        $pdf = $this->createPdfDocument($title, 'Generated Dropped Franchises Report');

        $genderSummary = $this->buildGenderSummaryText($rows, true);

        $this->writeHtmlChunks($pdf, [
            $this->getSharedReportStyles(),
            '<p class="report-title">' . htmlspecialchars($title) . '</p>',
            '<p class="subtitle">' . htmlspecialchars($subtitle) . '</p>',
            '<p class="meta">Total Records: ' . count($rows) . '|' . $this->escapePdfValue($genderSummary) . '</p>',
            '<table><thead><tr>
                <th style="width:3%;">#</th>
                <th style="width:12%;">OPERATOR</th>
                <th style="width:4%;font-size: 10px;">GENDER</th>
                <th style="width:10%;">ADDRESS</th>
                <th style="width:8%;">FRANCHISE NO.</th>
                <th style="width:9%;">ROUTE</th>
                <th style="width:6%;">MAKE</th>
                <th style="width:7%;">PLATE NO.</th>
                <th style="width:7%;">DATE ISSUED</th>
                <th style="width:7%;">LAST EXPIRY</th>
                <th style="width:7%;">DATE DROPPED</th>
                <th style="width:20%;">DROP REASON</th>
            </tr></thead><tbody>',
        ]);

        $rowHtml = [];
        foreach ($rows as $index => $item) {
            $rowHtml[] = '<tr>
                <td style="text-align:center;">' . ($index + 1) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['Name'] ?? ''))) . '</td>
                <td style="text-align:center;">' . htmlspecialchars($this->normalizeGenderLabel($item['Gender'] ?? null)) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['Address'] ?? ''))) . '</td>
                <td style="text-align:center;"><strong>' . htmlspecialchars((string)($item['FranchiseNo'] ?? '')) . '</strong></td>
                <td>' . htmlspecialchars(strtoupper((string)($item['Route'] ?? ''))) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['MakeName'] ?? ''))) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['PlateNo'] ?? ''))) . '</td>
                <td style="text-align:center;">' . htmlspecialchars((string)($item['DateIssued'] ?? '')) . '</td>
                <td style="text-align:center;">' . htmlspecialchars((string)(($item['ExpiryDate'] ?? '') === '0000-00-00' ? '' : ($item['ExpiryDate'] ?? ''))) . '</td>
                <td style="text-align:center;">' . htmlspecialchars(substr((string)($item['DroppedAt'] ?? ''), 0, 10)) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['DropReason'] ?? ''))) . '</td>
            </tr>';
        }

        $this->writeTableRowsInChunks($pdf, $rowHtml, 100);
        $pdf->WriteHTML('</tbody></table>');

        [$outputMode, $contentDisposition] = $this->getPdfDisposition();
        $fileName = 'Dropped_Franchise_Masterlist_' . date('Y-m-d-H-i-s') . '.pdf';

        header('Content-Type: application/pdf');
        header('Content-Disposition: ' . $contentDisposition . '; filename="' . $fileName . '"');
        header('Cache-Control: private, max-age=0, must-revalidate');
        header('Pragma: public');

        $pdf->Output($fileName, $outputMode);
        exit;
    }



    private function generatePerHolderSummaryPDF(array $rows, ?string $startDate = null, ?string $endDate = null): void {
        $totalHolders = count($rows);
        // $title = 'PER HOLDER SUMMARY OF ACTIVE FRANCHISES (TOTAL ACTIVE FRANCHISE HOLDERS: ' . $totalHolders . ')';
        
        $totalActiveUnits = array_sum(array_map(static fn ($row) => (int)($row['ActiveUnitCount'] ?? 0), $rows));
        $title = 'PER HOLDER SUMMARY OF ACTIVE FRANCHISES (TOTAL FRANCHISES: ' . $totalActiveUnits . ')';
        $dateFilterLabel = $this->buildOptionalDateRangeLabel($startDate, $endDate, 'All');
        $pdf = $this->createPdfDocument($title, 'Generated Per Holder Franchise Summary');

        $genderSummary = $this->buildGenderSummaryText($rows, true);

        $this->writeHtmlChunks($pdf, [
            $this->getSharedReportStyles(),
            '<p class="report-title">' . htmlspecialchars($title) . '</p>',
            // '<p class="meta">Total Active Units: ' . $totalActiveUnits . ' | Date Filter: ' . htmlspecialchars($dateFilterLabel) . '</p>',
            '<p class="meta">Date Filter: ' . htmlspecialchars($dateFilterLabel) . ' | ' . htmlspecialchars($genderSummary) . '</p>',
            '<table><thead><tr>
                <th style="width:3%;">#</th>
                <th style="width:15%;">OPERATOR</th>
                <th style="width:5%;">GENDER</th>
                <th style="width:16%;">ADDRESS</th>
                <th style="width:8%;">CONTACT NO.</th>
                <th style="width:6%;">ACTIVE UNITS</th>
                <th style="width:14%;">FRANCHISE NOS.</th>
                <th style="width:11%;">PLATE NOS.</th>
                <th style="width:14%;">ROUTES</th>
                <th style="width:8%;">NEAREST EXPIRY</th>
            </tr></thead><tbody>',
        ]);

        $rowHtml = [];
        foreach ($rows as $index => $item) {
            $rowHtml[] = '<tr>
                <td style="text-align:center;">' . ($index + 1) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['Name'] ?? ''))) . '</td>
                <td style="text-align:center;">' . htmlspecialchars($this->normalizeGenderLabel($item['Gender'] ?? null)) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['Address'] ?? ''))) . '</td>
                <td>' . htmlspecialchars((string)($item['ContactNo'] ?? '')) . '</td>
                <td style="text-align:center;">' . (int)($item['ActiveUnitCount'] ?? 0) . '</td>
                <td>' . htmlspecialchars((string)($item['FranchiseNos'] ?? '')) . '</td>
                <td>' . htmlspecialchars((string)($item['PlateNos'] ?? '')) . '</td>
                <td>' . htmlspecialchars(strtoupper((string)($item['Routes'] ?? ''))) . '</td>
                <td style="text-align:center;">' . htmlspecialchars((string)(($item['NearestExpiryDate'] ?? '') === '0000-00-00' ? '' : ($item['NearestExpiryDate'] ?? ''))) . '</td>
            </tr>';
        }

        $this->writeTableRowsInChunks($pdf, $rowHtml, 100);
        $pdf->WriteHTML('</tbody></table>');

        [$outputMode, $contentDisposition] = $this->getPdfDisposition();
        $fileName = 'Per_Holder_Summary_Active_Franchises_' . date('Y-m-d-H-i-s') . '.pdf';

        header('Content-Type: application/pdf');
        header('Content-Disposition: ' . $contentDisposition . '; filename="' . $fileName . '"');
        header('Cache-Control: private, max-age=0, must-revalidate');
        header('Pragma: public');

        $pdf->Output($fileName, $outputMode);
        exit;
    }


    private function generateSummaryByRoutePDF(array $rows, string $startDate, string $endDate): void {
        [$outputMode, $contentDisposition] = $this->getPdfDisposition();
        $pdf = $this->createPdfDocument('Summary By Route', 'Generated Summary By Route');

        $dateRangeString = $this->buildDateRangeLabel($startDate, $endDate);

        $genderSummary = $this->buildGenderSummaryText($rows, true);

        $summary = [];
        $grand = ['new' => 0, 'renew' => 0, 'total' => 0];

        foreach ($rows as $r) {
            $route = strtoupper(trim((string)($r['Route'] ?? 'UNKNOWN')));
            $status = strtolower(trim((string)($r['Status'] ?? '')));

            if (!isset($summary[$route])) {
                $summary[$route] = ['new' => 0, 'renew' => 0, 'total' => 0];
            }

            $summary[$route]['total']++;
            $grand['total']++;

            if ($status === 'new') {
                $summary[$route]['new']++;
                $grand['new']++;
            } elseif ($status === 'renew') {
                $summary[$route]['renew']++;
                $grand['renew']++;
            }
        }

        ksort($summary);

        $this->writeHtmlChunks($pdf, [
            $this->getSharedReportStyles(),
            '<p class="report-title">SUMMARY OF FRANCHISES BY ROUTE</p>',
            '<p class="subtitle">' . htmlspecialchars($dateRangeString) . '</p>',
            '<p class="meta">' . htmlspecialchars($genderSummary) . '</p>',
            '<div class="section-title">OVERALL SUMMARY</div>',
            '<table class="overall-table"><thead><tr>
                <th style="text-align:left;">ROUTE</th>
                <th>NEW</th>
                <th>RENEW</th>
                <th>TOTAL</th>
            </tr></thead><tbody>',
        ]);

        $summaryRows = [];
        foreach ($summary as $routeName => $counts) {
            $summaryRows[] = '
                <tr>
                    <td class="route-name">' . htmlspecialchars($routeName) . '</td>
                    <td>' . (int)$counts['new'] . '</td>
                    <td>' . (int)$counts['renew'] . '</td>
                    <td>' . (int)$counts['total'] . '</td>
                </tr>
            ';
        }
        $summaryRows[] = '
            <tr class="grand-row">
                <td class="route-name">GRAND TOTAL</td>
                <td>' . (int)$grand['new'] . '</td>
                <td>' . (int)$grand['renew'] . '</td>
                <td>' . (int)$grand['total'] . '</td>
            </tr>
        ';
        $this->writeTableRowsInChunks($pdf, $summaryRows, 100);
        $pdf->WriteHTML('</tbody></table>');

        $groupedRows = [];
        foreach ($rows as $row) {
            $route = strtoupper(trim((string)($row['Route'] ?? 'UNKNOWN')));
            $groupedRows[$route][] = $row;
        }
        ksort($groupedRows);

        foreach ($groupedRows as $routeName => $routeRows) {
            $routeTotals = ['total' => 0, 'new' => 0, 'renew' => 0];

            $pdf->WriteHTML('<div class="route">ROUTE: ' . htmlspecialchars($routeName) . '</div>');

            $pdf->WriteHTML('<table><thead><tr>
                <th style="width:3%;">#</th>
                <th style="width:11%;">OPERATOR</th>
                <th style="width:4%;">GENDER</th>
                <th style="width:13%;">ADDRESS</th>
                <th style="width:7%;">FRANCHISE NO.</th>
                <th style="width:7%;">DATE ISSUED</th>
                <th style="width:7%;">EXPIRY</th>
                <th style="width:6%;">PLATE</th>
                <th style="width:6%;">MAKE</th>
                <th style="width:9%;">ENGINE NO.</th>
                <th style="width:9%;">CHASSIS NO.</th>
                <th style="width:7%;">OR NO.</th>
                <th style="width:6%;">AMOUNT</th>
                <th style="width:5%;">STATUS</th>
            </tr></thead><tbody>');

            $routeRowHtml = [];
            foreach ($routeRows as $index => $row) {
                $status = strtolower((string)($row['Status'] ?? ''));
                $routeTotals['total']++;

                if ($status === 'new') {
                    $routeTotals['new']++;
                } elseif ($status === 'renew') {
                    $routeTotals['renew']++;
                }

                $amount = isset($row['Amount']) && $row['Amount'] !== null
                    ? number_format((float)$row['Amount'], 2)
                    : '';

                $routeRowHtml[] = '<tr>
                    <td style="text-align:center;">' . ($index + 1) . '</td>
                    <td>' . htmlspecialchars(strtoupper((string)($row['Name'] ?? ''))) . '</td>
                    <td style="text-align:center;">' . htmlspecialchars($this->normalizeGenderLabel($row['Gender'] ?? null)) . '</td>
                    <td>' . htmlspecialchars(strtoupper((string)($row['Address'] ?? ''))) . '</td>
                    <td style="text-align:center;"><strong>' . htmlspecialchars((string)($row['FranchiseNo'] ?? '')) . '</strong></td>
                    <td style="text-align:center;">' . htmlspecialchars((string)($row['DateIssued'] ?? '')) . '</td>
                    <td style="text-align:center;">' . htmlspecialchars((string)(($row['ExpiryDate'] ?? '') === '0000-00-00' ? '' : ($row['ExpiryDate'] ?? ''))) . '</td>
                    <td style="text-align:center;">' . htmlspecialchars(strtoupper((string)($row['PlateNo'] ?? ''))) . '</td>
                    <td>' . htmlspecialchars(strtoupper((string)($row['MakeName'] ?? ''))) . '</td>
                    <td>' . htmlspecialchars(strtoupper((string)($row['EngineNo'] ?? ''))) . '</td>
                    <td>' . htmlspecialchars(strtoupper((string)($row['ChassisNo'] ?? ''))) . '</td>
                    <td style="text-align:center;">' . htmlspecialchars(strtoupper((string)($row['ORNo'] ?? ''))) . '</td>
                    <td style="text-align:right;">' . htmlspecialchars($amount) . '</td>
                    <td style="text-align:center;">' . htmlspecialchars(strtoupper((string)($row['Status'] ?? ''))) . '</td>
                </tr>';
            }

            $this->writeTableRowsInChunks($pdf, $routeRowHtml, 100);
            $pdf->WriteHTML('</tbody></table>');
            $pdf->WriteHTML(
                '<div class="totals"><strong>Route Franchise totals:</strong> Total: '
                . (int)$routeTotals['total']
                . ', New: ' . (int)$routeTotals['new']
                . ', Renew: ' . (int)$routeTotals['renew']
                . '</div>'
            );
        }

        $fileName = 'Franchise_Summary_By_Route_' . date('Y-m-d-H-i-s') . '.pdf';
        header('Content-Type: application/pdf');
        header('Content-Disposition: ' . $contentDisposition . '; filename="' . $fileName . '"');
        header('Cache-Control: private, max-age=0, must-revalidate');
        header('Pragma: public');

        $pdf->Output($fileName, $outputMode);
        exit;
    }



    private function createExcelSpreadsheet(string $title, string $subject): Spreadsheet {
        $spreadsheet = new Spreadsheet();
        $spreadsheet->getProperties()
            ->setCreator('FAST-SB Application')
            ->setLastModifiedBy('FAST-SB Application')
            ->setTitle($title)
            ->setSubject($subject)
            ->setDescription($subject);

        $spreadsheet->getDefaultStyle()->getFont()->setName('Calibri')->setSize(9);
        $spreadsheet->getActiveSheet()->setShowGridlines(false);

        return $spreadsheet;
    }

    private function sanitizeExcelSheetTitle(string $title): string {
        $sanitized = preg_replace('/[\\\/?*\[\]:]/', ' ', $title) ?: 'Report';
        $sanitized = trim(preg_replace('/\s+/', ' ', $sanitized) ?: 'Report');

        if ($sanitized === '') {
            $sanitized = 'Report';
        }

        return mb_substr($sanitized, 0, 31);
    }

    private function tryAddExcelLogo(Worksheet $sheet, string $coordinate, string $relativePath, int $height = 55): void {
        try {
            $path = $this->resolveAssetPath($relativePath);
            $drawing = new Drawing();
            $drawing->setPath($path);
            $drawing->setCoordinates($coordinate);
            $drawing->setWorksheet($sheet);
            $drawing->setHeight($height);
            $drawing->setOffsetX(5);
            $drawing->setOffsetY(5);
        } catch (\Throwable) {
            // Ignore missing logos for Excel export to avoid blocking the workbook download.
        }
    }

    private function applyExcelBrandHeader(Worksheet $sheet, int $lastColumnIndex): int {
        $lastCol = Coordinate::stringFromColumnIndex($lastColumnIndex);
        $centerStart = 'A';
        $centerEndIndex = max(2, $lastColumnIndex);
        $centerEnd = Coordinate::stringFromColumnIndex($centerEndIndex);

        for ($row = 1; $row <= 4; $row++) {
            if ($centerStart !== $centerEnd || $centerStart !== 'A') {
                $sheet->mergeCells("{$centerStart}{$row}:{$centerEnd}{$row}");
            }
        }

        $sheet->setCellValue("{$centerStart}1", 'REPUBLIC OF THE PHILIPPINES');
        $sheet->setCellValue("{$centerStart}2", 'PROVINCE OF DAVAO DEL SUR');
        $sheet->setCellValue("{$centerStart}3", 'MUNICIPALITY OF SANTA CRUZ');

        $sheet->getStyle("{$centerStart}1:{$centerEnd}3")->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)
            ->setVertical(Alignment::VERTICAL_CENTER);
        $sheet->getStyle("{$centerStart}1:{$centerEnd}1")->getFont()->setSize(10);
        $sheet->getStyle("{$centerStart}2:{$centerEnd}2")->getFont()->setSize(11)->setBold(true);
        $sheet->getStyle("{$centerStart}3:{$centerEnd}3")->getFont()->setSize(16)->setBold(true);

        $sheet->getRowDimension(1)->setRowHeight(18);
        $sheet->getRowDimension(2)->setRowHeight(18);
        $sheet->getRowDimension(3)->setRowHeight(24);
        $sheet->getRowDimension(4)->setRowHeight(8);

        $this->tryAddExcelLogo($sheet, 'A1', 'storage/images/left.jpg', 60);
        $this->tryAddExcelLogo($sheet, $lastCol . '1', 'storage/images/right.jpg', 60);

        return 5;
    }

    private function writeExcelReportHeader(Worksheet $sheet, string $title, string $subtitle, string $meta, int $lastColumnIndex): int {
        $lastCol = Coordinate::stringFromColumnIndex($lastColumnIndex);
        $row = $this->applyExcelBrandHeader($sheet, $lastColumnIndex);

        $sheet->mergeCells("A{$row}:{$lastCol}{$row}");
        $sheet->setCellValue("A{$row}", $title);
        $sheet->getStyle("A{$row}:{$lastCol}{$row}")->getFont()->setBold(true)->setSize(14);
        $sheet->getStyle("A{$row}:{$lastCol}{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getRowDimension($row)->setRowHeight(22);
        $row++;

        $sheet->mergeCells("A{$row}:{$lastCol}{$row}");
        $sheet->setCellValue("A{$row}", $subtitle);
        $sheet->getStyle("A{$row}:{$lastCol}{$row}")->getFont()->setItalic(true)->setSize(10);
        $sheet->getStyle("A{$row}:{$lastCol}{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getRowDimension($row)->setRowHeight(18);
        $row++;

        $sheet->mergeCells("A{$row}:{$lastCol}{$row}");
        $sheet->setCellValue("A{$row}", $meta);
        $sheet->getStyle("A{$row}:{$lastCol}{$row}")->getFont()->setSize(9);
        $sheet->getStyle("A{$row}:{$lastCol}{$row}")->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)
            ->setWrapText(true);
        $sheet->getRowDimension($row)->setRowHeight(22);
        $row += 2;

        return $row;
    }

    private function applyExcelTableHeaderStyle(Worksheet $sheet, string $range): void {
        $sheet->getStyle($range)->applyFromArray([
            'font' => [
                'bold' => true,
                'size' => 9,
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'wrapText' => true,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'F3F3F3'],
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'D9D9D9'],
                ],
            ],
        ]);
    }

    private function applyExcelBodyStyle(Worksheet $sheet, string $range): void {
        $sheet->getStyle($range)->applyFromArray([
            'alignment' => [
                'vertical' => Alignment::VERTICAL_TOP,
                'wrapText' => true,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'D9D9D9'],
                ],
            ],
        ]);
    }

    private function excelHorizontalAlignment(string $align): string {
        return match (strtolower($align)) {
            'center' => Alignment::HORIZONTAL_CENTER,
            'right' => Alignment::HORIZONTAL_RIGHT,
            default => Alignment::HORIZONTAL_LEFT,
        };
    }

    private function writeExcelTable(Worksheet $sheet, int $startRow, array $columns, array $rows, string $emptyMessage = 'No records found for the selected filter.'): int {
        $columnCount = count($columns);
        $lastCol = Coordinate::stringFromColumnIndex($columnCount);

        foreach ($columns as $index => $column) {
            $columnLetter = Coordinate::stringFromColumnIndex($index + 1);
            $sheet->setCellValue("{$columnLetter}{$startRow}", (string)($column['label'] ?? ''));
            $sheet->getColumnDimension($columnLetter)->setWidth((float)($column['width'] ?? 12));
        }

        $this->applyExcelTableHeaderStyle($sheet, "A{$startRow}:{$lastCol}{$startRow}");
        $sheet->getRowDimension($startRow)->setRowHeight(24);

        $currentRow = $startRow + 1;

        if (empty($rows)) {
            $sheet->mergeCells("A{$currentRow}:{$lastCol}{$currentRow}");
            $sheet->setCellValue("A{$currentRow}", $emptyMessage);
            $sheet->getStyle("A{$currentRow}:{$lastCol}{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $this->applyExcelBodyStyle($sheet, "A{$currentRow}:{$lastCol}{$currentRow}");
            $sheet->getRowDimension($currentRow)->setRowHeight(22);
            return $currentRow;
        }

        foreach ($rows as $rowIndex => $row) {
            foreach ($columns as $index => $column) {
                $columnLetter = Coordinate::stringFromColumnIndex($index + 1);
                $cell = "{$columnLetter}{$currentRow}";
                $valueResolver = $column['value'] ?? null;
                $value = is_callable($valueResolver)
                    ? $valueResolver($row, $rowIndex)
                    : ($row[(string)($column['key'] ?? '')] ?? '');

                if (($column['type'] ?? 'string') === 'numeric' && $value !== '' && $value !== null) {
                    $sheet->setCellValue($cell, (float)$value);
                } else {
                    $sheet->setCellValue($cell, (string)($value ?? ''));
                }

                $sheet->getStyle($cell)->getAlignment()->setHorizontal(
                    $this->excelHorizontalAlignment((string)($column['align'] ?? 'left'))
                );

                if (!empty($column['format'])) {
                    $sheet->getStyle($cell)->getNumberFormat()->setFormatCode((string)$column['format']);
                }
            }

            $sheet->getRowDimension($currentRow)->setRowHeight(24);
            $currentRow++;
        }

        $endRow = $currentRow - 1;
        $this->applyExcelBodyStyle($sheet, "A" . ($startRow + 1) . ":{$lastCol}{$endRow}");

        return $endRow;
    }

    private function finalizeExcelWorksheet(Worksheet $sheet, int $lastColumnIndex, int $lastRow, int $repeatHeaderEndRow, string $orientation = PageSetup::ORIENTATION_LANDSCAPE, ?string $freezePane = null): void {
        $lastCol = Coordinate::stringFromColumnIndex($lastColumnIndex);
        $pageSetup = $sheet->getPageSetup();
        $pageSetup->setOrientation($orientation);
        $pageSetup->setPaperSize(PageSetup::PAPERSIZE_LEGAL);
        $pageSetup->setFitToPage(true);
        $pageSetup->setFitToWidth(1);
        $pageSetup->setFitToHeight(0);
        $pageSetup->setRowsToRepeatAtTopByStartAndEnd(1, $repeatHeaderEndRow);
        $pageSetup->setPrintArea("A1:{$lastCol}{$lastRow}");

        $sheet->getPageMargins()
            ->setTop(0.35)
            ->setBottom(0.35)
            ->setLeft(0.20)
            ->setRight(0.20)
            ->setHeader(0.15)
            ->setFooter(0.15);

        $sheet->getHeaderFooter()->setOddFooter('&RPage &P of &N');
        $sheet->getPageSetup()->setHorizontalCentered(true);

        if ($freezePane) {
            $sheet->freezePane($freezePane);
        }
    }

    private function streamExcelOutput(Spreadsheet $spreadsheet, string $fileName): void {
        if (function_exists('ob_get_level')) {
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
        }

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Cache-Control: max-age=0, private, must-revalidate');
        header('Pragma: public');

        $writer = new Xlsx($spreadsheet);
        $writer->setPreCalculateFormulas(false);
        $writer->save('php://output');
        $spreadsheet->disconnectWorksheets();
        exit;
    }

    private function buildOperatorCellText(array $item): string {
        $driver = strtoupper(trim((string)($item['Driver'] ?? '')));
        $name = strtoupper(trim((string)($item['Name'] ?? '')));

        if ($driver !== '' && $name !== '') {
            return $driver . "
(Operator: {$name})";
        }

        return $driver !== '' ? $driver : $name;
    }

    private function generateFranchiseExcel(array $franchises, ?string $startDate, ?string $endDate, string $statusFilter = 'all', string $reportType = 'report'): void {
        $isActiveReport = ($reportType === 'activeHolders');
        $title = $isActiveReport ? 'ACTIVE FRANCHISE REPORT' : 'MTOP FRANCHISE REPORT';
        $activeReportStartDate = $isActiveReport ? ($startDate ?: date('Y-m-d')) : null;
        $dateFilterLabel = $isActiveReport
            ? $this->buildOptionalDateRangeLabel($activeReportStartDate, $endDate, 'From ' . date('F j, Y'))
            : $this->buildDateRangeLabel((string)$startDate, (string)$endDate);
        $subtitle = $isActiveReport
            ? 'Franchise records filtered using franchise expiry date'
            : $dateFilterLabel;
        $filterLabel = $isActiveReport
            ? 'ACTIVE / EXPIRY DATE FILTER'
            : match ($statusFilter) {
                'drop' => 'DROPPED',
                'renew' => 'RENEW',
                'new' => 'NEW',
                'expired' => 'EXPIRED',
                default => 'ALL',
            };

        $spreadsheet = $this->createExcelSpreadsheet($title, 'Generated Franchise Report');
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle($this->sanitizeExcelSheetTitle($title));

        $columns = [
            ['label' => '#', 'width' => 5, 'align' => 'center', 'value' => static fn (array $row, int $index): int => $index + 1],
            ['label' => 'DRIVER (OPERATOR)', 'width' => 24, 'value' => fn (array $row): string => $this->buildOperatorCellText($row)],
            ['label' => 'ADDRESS', 'width' => 24, 'value' => static fn (array $row): string => strtoupper((string)($row['Address'] ?? ''))],
            ['label' => 'FRANCHISE NO.', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => (string)($row['FranchiseNo'] ?? '')],
            ['label' => 'DATE ISSUED', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => (string)($row['DateIssued'] ?? '')],
            ['label' => 'ROUTE', 'width' => 18, 'value' => static fn (array $row): string => strtoupper((string)($row['Route'] ?? ''))],
            ['label' => 'MAKE', 'width' => 12, 'value' => static fn (array $row): string => strtoupper((string)($row['MakeName'] ?? ''))],
            ['label' => 'ENGINE NO.', 'width' => 16, 'value' => static fn (array $row): string => strtoupper((string)($row['EngineNo'] ?? ''))],
            ['label' => 'CHASSIS NO.', 'width' => 16, 'value' => static fn (array $row): string => strtoupper((string)($row['ChassisNo'] ?? ''))],
            ['label' => 'PLATE NO.', 'width' => 14, 'value' => static fn (array $row): string => strtoupper((string)($row['PlateNo'] ?? ''))],
        ];

        $meta = 'Status Filter: ' . $filterLabel . ' | Date Filter: ' . $dateFilterLabel . ' | Total Records: ' . count($franchises);
        $tableStartRow = $this->writeExcelReportHeader($sheet, $title, $subtitle, $meta, count($columns));
        $lastRow = $this->writeExcelTable($sheet, $tableStartRow, $columns, $franchises, 'No franchise records found for the selected filter.');
        $this->finalizeExcelWorksheet($sheet, count($columns), $lastRow, $tableStartRow, PageSetup::ORIENTATION_LANDSCAPE, 'A' . ($tableStartRow + 1));

        $filePrefix = $isActiveReport ? 'Active_Franchise_Holders_Report_' : 'Franchise_Report_';
        $fileName = $filePrefix . date('Y-m-d-H-i-s') . '.xlsx';
        $this->streamExcelOutput($spreadsheet, $fileName);
    }

    private function generateExpiringFranchisesExcel(array $rows, int $window): void {
        $title = 'FRANCHISES EXPIRING WITHIN ' . $window . ' DAYS';
        $subtitle = 'Current active franchise units expiring between ' . date('F j, Y') . ' and ' . date('F j, Y', strtotime('+' . $window . ' days'));
        $meta = 'Total Records: ' . count($rows) . ' | ' . $this->buildGenderSummaryText($rows, true);

        $spreadsheet = $this->createExcelSpreadsheet($title, 'Generated Expiring Franchises Report');
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle($this->sanitizeExcelSheetTitle('Expiring ' . $window . ' Days'));

        $columns = [
            ['label' => '#', 'width' => 5, 'align' => 'center', 'value' => static fn (array $row, int $index): int => $index + 1],
            ['label' => 'OPERATOR', 'width' => 22, 'value' => static fn (array $row): string => strtoupper((string)($row['Name'] ?? ''))],
            ['label' => 'GENDER', 'width' => 9, 'align' => 'center', 'value' => fn (array $row): string => $this->normalizeGenderLabel($row['Gender'] ?? null)],
            ['label' => 'ADDRESS', 'width' => 24, 'value' => static fn (array $row): string => strtoupper((string)($row['Address'] ?? ''))],
            ['label' => 'FRANCHISE NO.', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => (string)($row['FranchiseNo'] ?? '')],
            ['label' => 'EXPIRY DATE', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => (string)($row['ExpiryDate'] ?? '')],
            ['label' => 'DAYS LEFT', 'width' => 10, 'align' => 'center', 'type' => 'numeric', 'value' => static fn (array $row): int => (int)($row['DaysRemaining'] ?? 0)],
            ['label' => 'ROUTE', 'width' => 18, 'value' => static fn (array $row): string => strtoupper((string)($row['Route'] ?? ''))],
            ['label' => 'MAKE', 'width' => 12, 'value' => static fn (array $row): string => strtoupper((string)($row['MakeName'] ?? ''))],
            ['label' => 'PLATE NO.', 'width' => 14, 'value' => static fn (array $row): string => strtoupper((string)($row['PlateNo'] ?? ''))],
            ['label' => 'STATUS', 'width' => 12, 'align' => 'center', 'value' => fn (array $row): string => $this->formatStatusLabel((string)($row['Status'] ?? ''), $row['ExpiryDate'] ?? null, false)],
        ];

        $tableStartRow = $this->writeExcelReportHeader($sheet, $title, $subtitle, $meta, count($columns));
        $lastRow = $this->writeExcelTable($sheet, $tableStartRow, $columns, $rows, 'No expiring franchises found within the selected window.');
        $this->finalizeExcelWorksheet($sheet, count($columns), $lastRow, $tableStartRow, PageSetup::ORIENTATION_LANDSCAPE, 'A' . ($tableStartRow + 1));

        $fileName = 'Franchises_Expiring_Within_' . $window . '_Days_' . date('Y-m-d-H-i-s') . '.xlsx';
        $this->streamExcelOutput($spreadsheet, $fileName);
    }

    private function generateDroppedMasterlistExcel(array $rows, ?string $startDate = null, ?string $endDate = null): void {
        $title = 'DROPPED FRANCHISE MASTERLIST';
        $subtitle = 'Date Filter: ' . $this->buildOptionalDateRangeLabel($startDate, $endDate, 'All');
        $meta = 'Total Records: ' . count($rows) . ' | ' . $this->buildGenderSummaryText($rows, true);

        $spreadsheet = $this->createExcelSpreadsheet($title, 'Generated Dropped Franchises Report');
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle($this->sanitizeExcelSheetTitle($title));

        $columns = [
            ['label' => '#', 'width' => 5, 'align' => 'center', 'value' => static fn (array $row, int $index): int => $index + 1],
            ['label' => 'OPERATOR', 'width' => 22, 'value' => static fn (array $row): string => strtoupper((string)($row['Name'] ?? ''))],
            ['label' => 'GENDER', 'width' => 9, 'align' => 'center', 'value' => fn (array $row): string => $this->normalizeGenderLabel($row['Gender'] ?? null)],
            ['label' => 'ADDRESS', 'width' => 22, 'value' => static fn (array $row): string => strtoupper((string)($row['Address'] ?? ''))],
            ['label' => 'FRANCHISE NO.', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => (string)($row['FranchiseNo'] ?? '')],
            ['label' => 'ROUTE', 'width' => 18, 'value' => static fn (array $row): string => strtoupper((string)($row['Route'] ?? ''))],
            ['label' => 'MAKE', 'width' => 12, 'value' => static fn (array $row): string => strtoupper((string)($row['MakeName'] ?? ''))],
            ['label' => 'PLATE NO.', 'width' => 14, 'value' => static fn (array $row): string => strtoupper((string)($row['PlateNo'] ?? ''))],
            ['label' => 'DATE ISSUED', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => (string)($row['DateIssued'] ?? '')],
            ['label' => 'LAST EXPIRY', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => (($row['ExpiryDate'] ?? '') === '0000-00-00' ? '' : (string)($row['ExpiryDate'] ?? ''))],
            ['label' => 'DATE DROPPED', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => substr((string)($row['DroppedAt'] ?? ''), 0, 10)],
            ['label' => 'DROP REASON', 'width' => 32, 'value' => static fn (array $row): string => strtoupper((string)($row['DropReason'] ?? ''))],
        ];

        $tableStartRow = $this->writeExcelReportHeader($sheet, $title, $subtitle, $meta, count($columns));
        $lastRow = $this->writeExcelTable($sheet, $tableStartRow, $columns, $rows, 'No dropped franchise records found for the selected filter.');
        $this->finalizeExcelWorksheet($sheet, count($columns), $lastRow, $tableStartRow, PageSetup::ORIENTATION_LANDSCAPE, 'A' . ($tableStartRow + 1));

        $fileName = 'Dropped_Franchise_Masterlist_' . date('Y-m-d-H-i-s') . '.xlsx';
        $this->streamExcelOutput($spreadsheet, $fileName);
    }

    private function generatePerHolderSummaryExcel(array $rows, ?string $startDate = null, ?string $endDate = null): void {
        $totalActiveUnits = array_sum(array_map(static fn (array $row): int => (int)($row['ActiveUnitCount'] ?? 0), $rows));
        $title = 'PER HOLDER SUMMARY OF ACTIVE FRANCHISES (TOTAL FRANCHISES: ' . $totalActiveUnits . ')';
        $subtitle = 'Date Filter: ' . $this->buildOptionalDateRangeLabel($startDate, $endDate, 'All') . ' | ' .$this->buildGenderSummaryText($rows, true);

        $spreadsheet = $this->createExcelSpreadsheet($title, 'Generated Per Holder Franchise Summary');
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle($this->sanitizeExcelSheetTitle('Per Holder Summary'));

        $columns = [
            ['label' => '#', 'width' => 5, 'align' => 'center', 'value' => static fn (array $row, int $index): int => $index + 1],
            ['label' => 'OPERATOR', 'width' => 24, 'value' => static fn (array $row): string => strtoupper((string)($row['Name'] ?? ''))],
            ['label' => 'GENDER', 'width' => 9, 'align' => 'center', 'value' => fn (array $row): string => $this->normalizeGenderLabel($row['Gender'] ?? null)],
            ['label' => 'ADDRESS', 'width' => 24, 'value' => static fn (array $row): string => strtoupper((string)($row['Address'] ?? ''))],
            ['label' => 'CONTACT NO.', 'width' => 16, 'value' => static fn (array $row): string => (string)($row['ContactNo'] ?? '')],
            ['label' => 'ACTIVE UNITS', 'width' => 11, 'align' => 'center', 'type' => 'numeric', 'value' => static fn (array $row): int => (int)($row['ActiveUnitCount'] ?? 0)],
            ['label' => 'FRANCHISE NOS.', 'width' => 24, 'value' => static fn (array $row): string => (string)($row['FranchiseNos'] ?? '')],
            ['label' => 'PLATE NOS.', 'width' => 18, 'value' => static fn (array $row): string => (string)($row['PlateNos'] ?? '')],
            ['label' => 'ROUTES', 'width' => 24, 'value' => static fn (array $row): string => strtoupper((string)($row['Routes'] ?? ''))],
            ['label' => 'NEAREST EXPIRY', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => (($row['NearestExpiryDate'] ?? '') === '0000-00-00' ? '' : (string)($row['NearestExpiryDate'] ?? ''))],
        ];

        $tableStartRow = $this->writeExcelReportHeader($sheet, $title, '', $subtitle, count($columns));
        $lastRow = $this->writeExcelTable($sheet, $tableStartRow, $columns, $rows, 'No active franchise holders found for the selected filter.');
        $this->finalizeExcelWorksheet($sheet, count($columns), $lastRow, $tableStartRow, PageSetup::ORIENTATION_LANDSCAPE, 'A' . ($tableStartRow + 1));

        $fileName = 'Per_Holder_Summary_Active_Franchises_' . date('Y-m-d-H-i-s') . '.xlsx';
        $this->streamExcelOutput($spreadsheet, $fileName);
    }

    private function generateSummaryByRouteExcel(array $rows, string $startDate, string $endDate): void {
        $title = 'SUMMARY OF FRANCHISES BY ROUTE';
        $subtitle = $this->buildDateRangeLabel($startDate, $endDate);
        $meta = $this->buildGenderSummaryText($rows, true);

        $summary = [];
        $grand = ['new' => 0, 'renew' => 0, 'total' => 0];

        foreach ($rows as $r) {
            $route = strtoupper(trim((string)($r['Route'] ?? 'UNKNOWN')));
            $status = strtolower(trim((string)($r['Status'] ?? '')));

            if (!isset($summary[$route])) {
                $summary[$route] = ['new' => 0, 'renew' => 0, 'total' => 0];
            }

            $summary[$route]['total']++;
            $grand['total']++;

            if ($status === 'new') {
                $summary[$route]['new']++;
                $grand['new']++;
            } elseif ($status === 'renew') {
                $summary[$route]['renew']++;
                $grand['renew']++;
            }
        }

        ksort($summary);

        $spreadsheet = $this->createExcelSpreadsheet($title, 'Generated Summary By Route');
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle($this->sanitizeExcelSheetTitle($title));

        $detailColumns = [
            ['label' => '#', 'width' => 5, 'align' => 'center', 'value' => static fn (array $row, int $index): int => $index + 1],
            ['label' => 'OPERATOR', 'width' => 20, 'value' => static fn (array $row): string => strtoupper((string)($row['Name'] ?? ''))],
            ['label' => 'GENDER', 'width' => 9, 'align' => 'center', 'value' => fn (array $row): string => $this->normalizeGenderLabel($row['Gender'] ?? null)],
            ['label' => 'ADDRESS', 'width' => 22, 'value' => static fn (array $row): string => strtoupper((string)($row['Address'] ?? ''))],
            ['label' => 'FRANCHISE NO.', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => (string)($row['FranchiseNo'] ?? '')],
            ['label' => 'DATE ISSUED', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => (string)($row['DateIssued'] ?? '')],
            ['label' => 'EXPIRY', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => (($row['ExpiryDate'] ?? '') === '0000-00-00' ? '' : (string)($row['ExpiryDate'] ?? ''))],
            ['label' => 'PLATE', 'width' => 12, 'align' => 'center', 'value' => static fn (array $row): string => strtoupper((string)($row['PlateNo'] ?? ''))],
            ['label' => 'MAKE', 'width' => 12, 'value' => static fn (array $row): string => strtoupper((string)($row['MakeName'] ?? ''))],
            ['label' => 'ENGINE NO.', 'width' => 16, 'value' => static fn (array $row): string => strtoupper((string)($row['EngineNo'] ?? ''))],
            ['label' => 'CHASSIS NO.', 'width' => 16, 'value' => static fn (array $row): string => strtoupper((string)($row['ChassisNo'] ?? ''))],
            ['label' => 'OR NO.', 'width' => 14, 'align' => 'center', 'value' => static fn (array $row): string => strtoupper((string)($row['ORNo'] ?? ''))],
            ['label' => 'AMOUNT', 'width' => 12, 'align' => 'right', 'type' => 'numeric', 'format' => '#,##0.00', 'value' => static fn (array $row): float => (float)($row['Amount'] ?? 0)],
            ['label' => 'STATUS', 'width' => 10, 'align' => 'center', 'value' => static fn (array $row): string => strtoupper((string)($row['Status'] ?? ''))],
        ];

        $tableStartRow = $this->writeExcelReportHeader($sheet, $title, $subtitle, $meta, count($detailColumns));

        $currentRow = $tableStartRow;
        $sheet->mergeCells('A' . $currentRow . ':D' . $currentRow);
        $sheet->setCellValue('A' . $currentRow, 'OVERALL SUMMARY');
        $sheet->getStyle('A' . $currentRow . ':D' . $currentRow)->getFont()->setBold(true)->setSize(10);
        $currentRow++;

        $overallColumns = [
            ['label' => 'ROUTE', 'width' => 24, 'value' => static fn (array $row): string => (string)($row['route'] ?? '')],
            ['label' => 'NEW', 'width' => 10, 'align' => 'center', 'type' => 'numeric', 'value' => static fn (array $row): int => (int)($row['new'] ?? 0)],
            ['label' => 'RENEW', 'width' => 10, 'align' => 'center', 'type' => 'numeric', 'value' => static fn (array $row): int => (int)($row['renew'] ?? 0)],
            ['label' => 'TOTAL', 'width' => 10, 'align' => 'center', 'type' => 'numeric', 'value' => static fn (array $row): int => (int)($row['total'] ?? 0)],
        ];

        $overallRows = [];
        foreach ($summary as $routeName => $counts) {
            $overallRows[] = [
                'route' => $routeName,
                'new' => $counts['new'],
                'renew' => $counts['renew'],
                'total' => $counts['total'],
            ];
        }
        $overallRows[] = [
            'route' => 'GRAND TOTAL',
            'new' => $grand['new'],
            'renew' => $grand['renew'],
            'total' => $grand['total'],
        ];

        $currentRow = $this->writeExcelTable($sheet, $currentRow, $overallColumns, $overallRows, 'No route summary available.');
        $sheet->getStyle('A' . $currentRow . ':D' . $currentRow)->getFont()->setBold(true);
        $currentRow += 2;

        $groupedRows = [];
        foreach ($rows as $row) {
            $route = strtoupper(trim((string)($row['Route'] ?? 'UNKNOWN')));
            $groupedRows[$route][] = $row;
        }
        ksort($groupedRows);

        foreach ($groupedRows as $routeName => $routeRows) {
            $routeTotals = ['total' => 0, 'new' => 0, 'renew' => 0];
            $lastDetailCol = Coordinate::stringFromColumnIndex(count($detailColumns));

            $sheet->mergeCells('A' . $currentRow . ':' . $lastDetailCol . $currentRow);
            $sheet->setCellValue('A' . $currentRow, 'ROUTE: ' . $routeName);
            $sheet->getStyle('A' . $currentRow . ':' . $lastDetailCol . $currentRow)->applyFromArray([
                'font' => ['bold' => true, 'size' => 10],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => 'FAFAFA'],
                ],
            ]);
            $currentRow++;

            foreach ($routeRows as $routeRow) {
                $status = strtolower((string)($routeRow['Status'] ?? ''));
                $routeTotals['total']++;
                if ($status === 'new') {
                    $routeTotals['new']++;
                } elseif ($status === 'renew') {
                    $routeTotals['renew']++;
                }
            }

            $currentRow = $this->writeExcelTable($sheet, $currentRow, $detailColumns, $routeRows, 'No records under this route.');
            $currentRow++;
            $sheet->mergeCells('A' . $currentRow . ':' . $lastDetailCol . $currentRow);
            $sheet->setCellValue('A' . $currentRow, 'Route Franchise totals: Total: ' . $routeTotals['total'] . ', New: ' . $routeTotals['new'] . ', Renew: ' . $routeTotals['renew']);
            $sheet->getStyle('A' . $currentRow . ':' . $lastDetailCol . $currentRow)->getFont()->setBold(true);
            $currentRow += 2;
        }

        $lastRow = max($currentRow - 1, $tableStartRow);
        $this->finalizeExcelWorksheet($sheet, count($detailColumns), $lastRow, $tableStartRow, PageSetup::ORIENTATION_LANDSCAPE, 'A' . ($tableStartRow + 1));

        $fileName = 'Franchise_Summary_By_Route_' . date('Y-m-d-H-i-s') . '.xlsx';
        $this->streamExcelOutput($spreadsheet, $fileName);
    }

    /**
     * Retrieves a single franchise record with associated applicant, make, and user names.
     *
     * @param string $id The ID of the franchise to retrieve.
     * @return array The franchise data, or an empty array if not found.
     */
    private function getFranchise($id): array {

        $franchise = Database::fetch(
            "SELECT 
                f.*,
                latestHistory.ExpiryDate as LatestExpiryDate,
                CONCAT(a.FirstName,IF(LENGTH(a.MiddleName) = 0,' ',CONCAT(' ',LEFT(a.MiddleName,1),'. ')),a.LastName) as ApplicantName,
                a.Gender,
                a.ContactNo,
                a.Address,
                m.Name as MakeName,
                CONCAT(u1.FirstName, ' ', u1.LastName) as CreatedByName,
                CONCAT(u2.FirstName, ' ', u2.LastName) as UpdatedByName
            FROM franchises f
            LEFT JOIN (
                SELECT FranchiseID, MAX(ExpiryDate) as ExpiryDate
                FROM franchise_history
                GROUP BY FranchiseID
            ) latestHistory ON latestHistory.FranchiseID = f.id
            LEFT JOIN applicants a ON a.id = f.ApplicantID
            LEFT JOIN makes m ON f.MakeID = m.id
            LEFT JOIN users u1 ON f.CreatedBy = u1.UserID
            LEFT JOIN users u2 ON f.UpdatedBy = u2.UserID
            WHERE f.id = ?",
            [$id]
        );

        if (!$franchise) {
            return [];
        }

        $documents = (new FranchiseDocumentService())->getDocuments((int)$id);
        $franchise['documents'] = $documents;
        $franchise['Documents'] = $documents;

        return $franchise;
    }

    /**
     * Retrieves the history records for a specific franchise.
     *
     * @param string $id The ID of the franchise whose history is to be retrieved.
     * @return array An array of franchise history records, or an empty array if none found.
     */
    private function getFranchiseHistories($id): array {
        $histories = Database::fetchAll("SELECT fh.*, CONCAT(u.FirstName, ' ', u.LastName) as CreatedByName
            FROM franchise_history fh
            LEFT JOIN users u ON fh.CreatedBy = u.UserID
            WHERE fh.FranchiseID = ? 
            ORDER BY fh.CreatedAt DESC",[$id]);
        return $histories ?? [];
    }
}