<?php
declare(strict_types=1);

namespace App\controllers;

use App\core\Database;
use Exception;
use App\core\Auth;

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
        
        $sql = "SELECT 
                    f.*,
                    CONCAT(a.FirstName,' ',a.LastName) as ApplicantName,
                    a.ContactNo,
                    a.Address,
                    m.Name as MakeName,
                    CONCAT(u1.FirstName, ' ', u1.LastName) as CreatedByName,
                    CONCAT(u2.FirstName, ' ', u2.LastName) as UpdatedByName
                FROM franchises f
                LEFT JOIN applicants a ON a.id = f.ApplicantID
                LEFT JOIN makes m ON f.MakeID = m.id
                LEFT JOIN users u1 ON f.CreatedBy = u1.UserID
                LEFT JOIN users u2 ON f.UpdatedBy = u2.UserID
                WHERE 1=1";
        
        $params = [];
        
        if ($status) {
            $sql .= " AND f.Status = ?";
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
            $sql .= " AND YEAR(f.DateIssued) = ?";
            $params[] = $year;
        }
        
        if ($search) {
            $sql .= " AND (f.FranchiseNo LIKE ? OR f.PlateNo LIKE ? OR f.ORNo LIKE ? OR a.Address LIKE ? OR 
                    a.ContactNo LIKE ? OR f.DateIssued LIKE ? OR f.ChassisNo LIKE ? OR f.EngineNo LIKE ? OR 
                    f.DropReason LIKE ? OR f.ExpiryDate LIKE ? or f.LastRenewalDate LIKE ? OR a.FirstName LIKE ? OR a.LastName LIKE ?)";
            $searchParam = "%{$search}%";
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
        }
        
        // Get total count
        $countSql = "SELECT COUNT(*) as total FROM franchises f 
                     LEFT JOIN applicants a ON a.id = f.ApplicantID
                     WHERE 1=1";
        $countParams = [];
        
        if ($status) {
            $countSql .= " AND f.Status = ?";
            $countParams[] = $status;
        }
        if ($makeID) {
            $countSql .= " AND f.MakeID = ?";
            $countParams[] = $makeID;
        }
        if ($route) {
            $countSql .= " AND f.Route LIKE ?";
            $countParams[] = "%{$route}%";
        }
        if ($year) {
            $countSql .= " AND YEAR(f.DateIssued) = ?";
            $countParams[] = $year;
        }
        if ($search) {
            $countSql .= " AND (f.FranchiseNo LIKE ? OR f.PlateNo LIKE ? OR f.ORNo LIKE ? OR a.Address LIKE ? OR 
                    a.ContactNo LIKE ? OR f.DateIssued LIKE ? OR f.ChassisNo LIKE ? OR f.EngineNo LIKE ? OR 
                    f.DropReason LIKE ? OR f.ExpiryDate LIKE ? or f.LastRenewalDate LIKE ? OR a.FirstName LIKE ? OR a.LastName LIKE ?)";
            $searchParam = "%{$search}%";
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
            $countParams[] = $searchParam;
        }
        
        $totalResult = Database::fetch($countSql, $countParams);
        $total = $totalResult['total'] ?? 0;
        
        $sql .= " ORDER BY f.DateIssued DESC, f.CreatedAt DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $franchises = Database::fetchAll($sql, $params);
        
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
            "SELECT id FROM franchises WHERE FranchiseNo = ?",
            [$data['FranchiseNo']]
        );
        
        if ($existing) {
            $this->response(false, 'Franchise number already exists', [], 409);
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
                "SELECT id FROM franchises WHERE FranchiseNo = ? AND id != ?",
                [$data['FranchiseNo'], $id]
            );
            if ($duplicate) {
                $this->response(false, 'Franchise number already exists', [], 409);
            }
        }

        if(isset($data['Status']) && $data['Status'] == 'renew' && !isset($data['LastRenewalDate'])){
            $data['LastRenewalDate'] = date('Y-m-d');
        }
        
        $userID = Auth::id();
        
        // Build update data
        $updateData = [];
        $allowedFields = ['FranchiseNo', 'DateIssued', 'Route', 'MakeID', 'ChassisNo', 'EngineNo', 'PlateNo', 'ORNo', 'Amount', 'Status', 'DropReason', 'ExpiryDate', 'LastRenewalDate'];
        
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
        $previousStatus = $existing['Status'];
        $newStatus = $data['Status'] ?? $existing['Status'];
        
        if (isset($data['Status']) && $data['Status'] !== $existing['Status']) {
            if ($data['Status'] === 'renew') {
                $actionType = 'renew';
                // Increment renewal count
                $updateData['RenewalCount'] = $existing['RenewalCount'] + 1;
            } elseif ($data['Status'] === 'drop') {
                $actionType = 'drop';
            }
        }
        
        try {
            // Update franchise
            $rowCount = Database::update('franchises', $updateData, 'id = :id', ['id' => $id]);
            $lastHistory = Database::fetch("SELECT * FROM franchise_history WHERE FranchiseID = ? AND ActionType IN('new','renew') ORDER BY CreatedAt DESC LIMIT 1", [$id]);

            // Record in history
            Database::insert('franchise_history', [
                'FranchiseID' => $id,
                'ActionType' => $actionType,
                'PreviousStatus' => $previousStatus,
                'NewStatus' => $newStatus,
                'DateIssued' => $actionType == 'renew' ? $lastHistory['ExpiryDate'] : $lastHistory['DateIssued'],
                'ExpiryDate' => $data['ExpiryDate'],
                'Route' => $data['Route'] ?? $existing['Route'],
                'PlateNo' => $data['PlateNo'] ?? $existing['PlateNo'],
                'ORNo' => $data['ORNo'] ?? $existing['ORNo'],
                'Amount' => $data['Amount'] ?? $existing['Amount'],
                'DropReason' => $data['DropReason'] ?? null,
                'ChangesJson' => json_encode($changes),
                'Remarks' => $data['Remarks'] ?? null,
                'CreatedBy' => $userID
            ]);

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

            // Perform deletion
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
        
        // Prepare WHERE clause based on year parameter
        $yearCondition = $year > 0 ? "WHERE YEAR(DateIssued) = ?" : "";
        $yearConditionAnd = $year > 0 ? "AND YEAR(f.DateIssued) = ?" : "";
        $params = $year > 0 ? [$year] : [];
        
        // Total franchises by status
        $statusStats = Database::fetchAll(
            "SELECT 
                Status,
                COUNT(*) as count
            FROM franchises
            $yearCondition
            GROUP BY Status",
            $params
        );
        
        // Franchises by route
        $routeStats = Database::fetchAll(
            "SELECT 
                Route,
                COUNT(*) as count
            FROM franchises
            $yearCondition
            GROUP BY Route
            ORDER BY count DESC",
            $params
        );
        
        // Franchises by make
        $makeQuery = "SELECT 
                m.Name as make_name,
                COUNT(f.id) as count
            FROM makes m
            LEFT JOIN franchises f ON m.id = f.MakeID" . 
            ($year > 0 ? " AND YEAR(f.DateIssued) = ?" : "") . "
            GROUP BY m.id, m.Name
            ORDER BY count DESC";
        
        $makeStats = Database::fetchAll($makeQuery, $params);
        
        // Monthly breakdown for the year (only when specific year is selected)
        $monthlyStats = [];
        if ($year > 0) {
            $monthlyStats = Database::fetchAll(
                "SELECT 
                    MONTH(DateIssued) as month,
                    Status,
                    COUNT(*) as count
                FROM franchises
                WHERE YEAR(DateIssued) = ?
                GROUP BY MONTH(DateIssued), Status
                ORDER BY month, Status",
                [$year]
            );
        } else {
            // For all years, show yearly breakdown instead
            $monthlyStats = Database::fetchAll(
                "SELECT 
                    YEAR(DateIssued) as year,
                    Status,
                    COUNT(*) as count
                FROM franchises
                GROUP BY YEAR(DateIssued), Status
                ORDER BY year DESC, Status"
            );
        }
        
        // Total counts
        $totals = Database::fetch(
            "SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN Status = 'new' THEN 1 ELSE 0 END) as new_count,
                SUM(CASE WHEN Status = 'renew' THEN 1 ELSE 0 END) as renew_count,
                SUM(CASE WHEN Status = 'drop' THEN 1 ELSE 0 END) as drop_count,
                SUM(CASE WHEN DATEDIFF(ExpiryDate, CURDATE()) <= 90 AND DATEDIFF(ExpiryDate, CURDATE()) >= 0 THEN 1 ELSE 0 END) as expiring_soon
            FROM franchises
            $yearCondition",
            $params
        );
        
        // Route breakdown by status
        $routeStatusBreakdown = Database::fetchAll(
            "SELECT 
                Route,
                Status,
                COUNT(*) as count
            FROM franchises
            $yearCondition
            GROUP BY Route, Status
            ORDER BY Route, Status",
            $params
        );
        
        // Available years for filtering
        $availableYears = Database::fetchAll(
            "SELECT DISTINCT YEAR(DateIssued) as year 
            FROM franchises 
            WHERE YEAR(DateIssued) IS NOT NULL AND YEAR(DateIssued) > 0
            ORDER BY year DESC"
        );
        
        // Available routes for filtering
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
        
        $data = json_decode(file_get_contents('php://input'), true);
        
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
        $renewalDate = date('Y-m-d');
        
        try {
            // Update franchise
            $updateData = [
                'Status' => 'renew',
                'RenewalCount' => $franchise['RenewalCount'] + 1,
                'LastRenewalDate' => $renewalDate,
                'ORNo' => $data['ORNo'],
                'Amount' => $data['Amount'],
                'UpdatedBy' => $userID
            ];
            
            // Optional: update expiry date
            if (!empty($data['ExpiryDate'])) {
                $updateData['ExpiryDate'] = $data['ExpiryDate'];
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
                'Route' => $franchise['Route'],
                'PlateNo' => $franchise['PlateNo'],
                'ORNo' => $data['ORNo'],
                'Amount' => $data['Amount'],
                'Remarks' => $data['Remarks'] ?? 'Franchise renewed',
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
            $this->response(false, 'Failed to renew franchise', [], 500);
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

        // 1. Fetch franchise data
        $franchise = $this->getFranchise($id);
        if (!$franchise) {
            $this->response(false, 'Franchise not found.', [], 404);
            return;
        }

        $lastHistory = Database::fetch("SELECT * FROM franchise_history WHERE FranchiseID = ? AND ActionType IN('new','renew') ORDER BY CreatedAt DESC LIMIT 1", [$id]);

        $franchiseNo = strtoupper($franchise['FranchiseNo'] ?? '');
        $dateIssued = date('F j, Y', strtotime($lastHistory['DateIssued']));

        $applicantName = strtoupper($franchise['ApplicantName'] ?? '');
        $address = strtoupper($franchise['Address'] ?? '');
        $route = strtoupper($franchise['Route'] ?? '');
        $make = strtoupper($franchise['MakeName'] ?? '');
        $engineNo = strtoupper($franchise['EngineNo'] ?? '');
        $chassisNo = strtoupper($franchise['ChassisNo'] ?? '');
        $plateNo = strtoupper($franchise['PlateNo'] ?? '');
        $orNo = strtoupper($lastHistory['ORNo'] ?? '');
        $amount = ($lastHistory['Amount']) ? 'PHP ' . number_format((float)$lastHistory['Amount'], 2) : '';

        if($route == 'JUNCTION'){
            $route = 'Lubo junction of Zone II to Sawmill (Fong) junction in Zone IV';
        }
        
        try {
            // 1. Create new PDF document using mPDF
            $pdf = new \Mpdf\Mpdf([
                'mode' => 'utf-8', 
                'format' => 'Legal-P', 
                'margin_left' => 10,
                'margin_right' => 10,
                'margin_top' => 75,  // Space for header
                'margin_bottom' => 25, // Space for footer
                'margin_header' => 10,
                'margin_footer' => 10,
                'default_font' => 'arial'
            ]);

            // 2. Set document information
            $pdf->SetCreator('SB-FMS Application');
            $pdf->SetAuthor('SB-FMS');
            $pdf->SetTitle('Franchise Application Form');
            $pdf->SetSubject('Generated Franchise Application Form');

            // 3. Set auto page breaks
            $pdf->SetAutoPageBreak(true, 15);

            // 4. Generate header with logos
            $headerLogoPath = 'storage/images/template-header.jpg';

            if (!file_exists($headerLogoPath)) {
                $this->response(false, 'PDF generation failed: Header logo image not found.', [], 500);
                return;
            }

            $headerLogo = base64_encode(file_get_contents($headerLogoPath));
            
            // Set header HTML for all pages
            $headerHtml = '
            <table width="100%" style="font-family: calibri; vertical-align: middle; text-align: center;" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="width: 100%; text-align: left;margin:0;padding:0;"><img src="data:image/jpg;base64,' . $headerLogo . '" width="100%" /></td>
                </tr>
            </table>';
            
            $pdf->SetHTMLHeader($headerHtml);
            
            $pdf->WriteHTML('<h1 style="width:100%;text-align: right;line-height: 1.2;font-weight: bold;font-size:16pt;margin-top:5px;padding-right:7px;padding-left:5px;">
                MTOP-SBSC CASE NO. '.$franchiseNo.'<br>
                <span style="width:100%;text-align: right;line-height: 0.5;font-weight: bold;font-size:14pt;">'.$dateIssued.'</span>
            </h1>');

            $pdf->WriteHTML('<h1 style="width:100%;text-align: left;line-height: 1.1;font-weight: bold;font-size:16pt;">
                MOTORIZED TRICYCLE OPERATOR\'S PERMIT (MTOP)<br>
                <span style="width:100%;text-align: left;font-weight: bold;font-size:11pt;">(Authority to operate an MCH vehicle)</span>
            </h1>');

            $table = '
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;border-width:1px;">
                    <tr>
                        <td width="40%" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:11pt;text-align: left;">NAME OF APPLICANT</td>
                        <td width="60%" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:14pt;text-align: left;">'.$applicantName.'</td>
                    </tr>
                    <tr>
                        <td width="40%" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:11pt;text-align: left;">ADDRESS</td>
                        <td width="60%" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:12pt;text-align: left;">'.$address.'</td>
                    </tr>
                    <tr>
                        <td width="40%" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:10.5pt;text-align: left;">ROUTE / ZONE / AREA  OF OPERATION</td>
                        <td width="60%" style="padding: 5px 10px;border: 1px solid #000;font-weight: bold;font-size:11pt;text-align: left;">'.$route.'</td>
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
                            <td style="border: 1px solid #000;font-weight: bold;font-size:12pt;text-align: center;padding:5px;">'.$make.'</td>
                            <td style="border: 1px solid #000;font-weight: bold;font-size:12pt;text-align: center;padding:5px;">'.$engineNo.'</td>
                            <td style="border: 1px solid #000;font-weight: bold;font-size:12pt;text-align: center;padding:5px;">'.$chassisNo.'</td>
                            <td style="border: 1px solid #000;font-weight: bold;font-size:12pt;text-align: center;padding:5px;">'.$plateNo.'</td>
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
                            The authority shall be valid for <strong style="color: #003366;text-decoration: underline;">FIVE (5) YEARS</strong> counted from the date of issuance.
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
                                    <td width="75%" style="padding-left:5px;border: none;font-weight: normal;font-size:8pt;text-align: left;">:&nbsp;'.$orNo.'</td>
                                </tr>
                                <tr>
                                    <td width="25%" style="border: none;font-weight: normal;font-size:8pt;text-align: left;">Amount</td>
                                    <td width="75%" style="padding-left:5px;border: none;font-weight: normal;font-size:8pt;text-align: left;">:&nbsp;'.$amount.'</td>
                                </tr>
                                <tr>
                                    <td width="25%" style="border: none;font-weight: normal;font-size:8pt;text-align: left;">Date</td>
                                    <td width="75%" style="padding-left:5px;border: none;font-weight: normal;font-size:8pt;text-align: left;">:&nbsp;'.$dateIssued.'</td>
                                </tr>
                            </table>
                        </td>
                        <td width="50%" style="border: none;font-weight: normal;font-size:11pt;text-align: left;">&nbsp;</td>
                    </tr>
                </table>
            ';

            $pdf->WriteHTML($table);

            // 10. Set footer for all pages
            $pdf->SetHTMLFooter('<div style="text-align: right; font-size: 10pt; font-weight: bold; padding: 5px 0;">Page {PAGENO} of {nbpg}</div>');

            // 11. Output PDF document
            $fileName = 'Franchise_Application_Form_' . $franchiseNo . '_' . date('Y-m-d-H-i-s') . '.pdf';
            
            // Set proper headers for PDF download
            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . $fileName . '"');
            header('Cache-Control: private, max-age=0, must-revalidate');
            header('Pragma: public');
            
            $pdf->Output($fileName, 'D'); // 'D' for download, 'I' for inline display
            
            exit;
            
        } catch (Exception $e) {
            error_log('exportFranchiseFormPDF error: ' . $e->getMessage());
            $this->response(false, 'PDF generation failed: ' . $e->getMessage(), [], 500);
            return;
        }
    }

    /**
     * GET: /api/franchises/export/pdf
     * Exports franchises to a PDF file with a custom header.
     */
    public function exportPDF(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);

        // Get date range from query params
        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;

        // Validate dates
        if (!$startDate || !$endDate) {
            $this->response(false, 'Start date and end date are required for PDF export.', [], 400);
        }

        try {
            // Fetch data for the PDF
            $franchises = $this->getFranchisesForExport($startDate, $endDate);

            // Generate and output the PDF
            $this->generateFranchisePDF($franchises, $startDate, $endDate);

        } catch (Exception $e) {
            error_log('PDF Export error: ' . $e->getMessage());
            $this->response(false, 'Failed to export PDF.', ['err' => $e->getMessage()], 500);
        }
    }

    /**
     * Fetches franchise data within a date range for exporting.
     */
    private function getFranchisesForExport(string $startDate, string $endDate): array {
        $sql = "
            SELECT DISTINCT
                f.ApplicantID, 
                f.FranchiseNo, 
                CONCAT(a.LastName, ', ', a.FirstName, ' ', LEFT(a.MiddleName, 1), '.') as Name, 
                a.Address, 
                f.PlateNo, 
                f.Route, 
                fh.DateIssued, 
                f.EngineNo, 
                f.ChassisNo,  
                fh.ExpiryDate, 
                fh.NewStatus as Status, 
                m.Name as MakeName
            FROM franchise_history fh
            JOIN franchises f ON fh.FranchiseID = f.id
            LEFT JOIN applicants a ON a.id = f.ApplicantID 
            LEFT JOIN makes m ON f.MakeID = m.id 
            WHERE (fh.DateIssued BETWEEN ? AND ?) AND fh.NewStatus IN ('new', 'renew')
            ORDER BY CONCAT(a.LastName, ', ', a.FirstName, ' ', LEFT(a.MiddleName, 1), '. - ',a.id) ASC, fh.DateIssued ASC";

        return Database::fetchAll($sql, [$startDate, $endDate]);
    }

    private function getApplicantFranchiseCounts(array $franchises): array {
        $counts = [];
        foreach ($franchises as $franchise) {
            $applicantId = $franchise['ApplicantID'];
            if (!isset($counts[$applicantId])) {
                $counts[$applicantId] = 0;
            }
            $counts[$applicantId]++;
        }
        return $counts;
    }

    /**
     * Generates the PDF document using mPDF.
     */
    private function generateFranchisePDF(array $franchises, string $startDate, string $endDate): void {
        try {
            // 1. Create new PDF document using mPDF
            $pdf = new \Mpdf\Mpdf([
                'mode' => 'utf-8', 
                'format' => 'Legal-L', 
                'margin_left' => 5,
                'margin_right' => 5,
                'margin_top' => 35,  // Space for header
                'margin_bottom' => 15, // Space for footer
                'margin_header' => 5,
                'margin_footer' => 5
            ]);

            // 2. Set document information
            $pdf->SetCreator('SB-FMS Application');
            $pdf->SetAuthor('SB-FMS');
            $pdf->SetTitle('Franchise Report');
            $pdf->SetSubject('Generated Franchise Report');

            // 3. Set auto page breaks
            $pdf->SetAutoPageBreak(true, 15);

            // 4. Generate header with logos
            $leftLogoPath = 'storage/images/left.jpg';
            $rightLogoPath = 'storage/images/right.jpg';

            if (!file_exists($leftLogoPath) || !file_exists($rightLogoPath)) {
                throw new Exception("PDF generation failed: Header logo image not found.");
            }

            $leftLogo = base64_encode(file_get_contents($leftLogoPath));
            $rightLogo = base64_encode(file_get_contents($rightLogoPath));
            
            // Set header HTML for all pages
            $headerHtml = '
            <table width="100%" style="font-family: calibri; vertical-align: middle; text-align: center;" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="width: 20%; text-align: left;"><img src="data:image/jpg;base64,' . $leftLogo . '" width="70" /></td>
                    <td style="width: 60%; text-align: center;">
                        <div style="font-size: 9pt; line-height: 1.2;">REPUBLIC OF THE PHILIPPINES</div>
                        <div style="font-size: 11pt; font-weight: bold; line-height: 1.2;">PROVINCE OF DAVAO DEL SUR</div>
                        <div style="font-size: 16pt; font-weight: bold; line-height: 1.2;">MUNICIPALITY OF SANTA CRUZ</div>
                    </td>
                    <td style="width: 20%; text-align: right;"><img src="data:image/jpg;base64,' . $rightLogo . '" width="70" /></td>
                </tr>
            </table>
            <hr style="margin: 5px 0 10px 0;" />';
            
            $pdf->SetHTMLHeader($headerHtml);

            // 5. Prepare date range string
            $dateRangeString = ''; 
            if ($startDate === $endDate) {
                $dateRangeString = 'On ' . date("F j, Y", strtotime($startDate));
            } else {
                $dateRangeString = date("F j, Y", strtotime($startDate)) . ' - ' . date("F j, Y", strtotime($endDate));
            }
            
            // 6. Get applicant franchise counts for rowspan
            $applicantFranchiseCounts = $this->getApplicantFranchiseCounts($franchises); 
            
            $recordNumber = 1;
            $processedApplicants = [];
            
            // 7. Build HTML content with styles and table
            $htmlContent = ' 
                <style>
                    .report-title { 
                        text-align: center; 
                        font-weight: bold; 
                        font-size: 13pt; 
                        line-height: 1.2; 
                        margin-bottom: 20px;
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        font-size: 8pt; 
                    }
                    .data-table th, 
                    .data-table td { 
                        border-top: 1px solid #ddd; 
                        padding: 4px; 
                        text-align: left; 
                        vertical-align: top; 
                    }
                    .data-table th { 
                        border-top: none; 
                        border-bottom: 1px solid #333; 
                        font-weight: bold; 
                        font-size: 7pt;
                        white-space: nowrap;
                    }
                    .data-table td {
                        font-size: 7pt;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                </style>
                <div class="report-title">
                    MTOP FRANCHISE REPORT<br>
                    <span style="font-size:9pt;">' . $dateRangeString . '</span>
                </div>
                <table class="data-table" cellpadding="4" cellspacing="0">
                    <thead>
                        <tr>
                            <th style="width: 3%;">#</th>
                            <th style="width: 10%;">OPERATOR</th>
                            <th style="width: 12%;">ADDRESS</th>
                            <th style="width: 8%;">FRANCHISE NO.</th>
                            <th style="width: 7%;">DATE ISSUED</th>
                            <th style="width: 7%;">EXPIRY DATE</th>
                            <th style="width: 8%;">ROUTE</th>
                            <th style="width: 6%;">MAKE</th>
                            <th style="width: 9%;">ENGINE NO.</th>
                            <th style="width: 9%;">CHASSIS NO.</th>
                            <th style="width: 6%;">PLATE NO.</th>
                            <th style="width: 6%;">STATUS</th>
                        </tr>
                    </thead>
                    <tbody>'; 
            
            // 8. Generate table rows
            foreach ($franchises as $item) {
                // Determine status color and text
                $color = ($item['Status'] == 'new') ? 'color: green;' : 
                        (($item['Status'] == 'renew') ? 'color: blue;' : 'color: orange;');
                $status = ($item['Status'] == 'new') ? 'NEW' : 
                        (($item['Status'] == 'renew') ? 'RENEWED' : 'DROPPED');
                
                // Format dates
                // $lastRenewalDate = (isset($item['LastRenewalDate']) && $item['LastRenewalDate'] !== '0000-00-00') 
                //     ? htmlspecialchars($item['LastRenewalDate']) : '';
                $expiryDate = (isset($item['ExpiryDate']) && $item['ExpiryDate'] !== '0000-00-00') 
                    ? htmlspecialchars($item['ExpiryDate']) : '';
                
                // Handle rowspan for operator and address
                $applicantId = $item['ApplicantID'];
                $applicantNameCell = '';
                $applicantAddressCell = '';
                
                if (!isset($processedApplicants[$applicantId])) {
                    $rowspan = $applicantFranchiseCounts[$applicantId];
                    $applicantNameCell = '<td style="border-right: 1px solid #ddd;" rowspan="' . $rowspan . '">' 
                        . strtoupper(htmlspecialchars($item['Name'] ?? '')) . '</td>';
                    $applicantAddressCell = '<td style="border-right: 1px solid #ddd;" rowspan="' . $rowspan . '">' 
                        . strtoupper(htmlspecialchars($item['Address'] ?? '')) . '</td>';
                    $processedApplicants[$applicantId] = true;
                }
                
                // Build row
                $htmlContent .= '<tr>
                    <td style="border-right: 1px solid #ddd;">' . $recordNumber++ . '</td>'
                    . $applicantNameCell 
                    . $applicantAddressCell 
                    . '<td><strong>' . htmlspecialchars($item['FranchiseNo']) . '</strong></td>
                    <td>' . htmlspecialchars($item['DateIssued'] ?? '') . '</td>
                    <td>' . $expiryDate . '</td>
                    <td>' . strtoupper(htmlspecialchars($item['Route'] ?? '')) . '</td>
                    <td>' . strtoupper(htmlspecialchars($item['MakeName'] ?? 'N/A')) . '</td>
                    <td>' . strtoupper(htmlspecialchars($item['EngineNo'] ?? '')) . '</td>
                    <td>' . strtoupper(htmlspecialchars($item['ChassisNo'] ?? '')) . '</td>
                    <td>' . strtoupper(htmlspecialchars($item['PlateNo'] ?? '')) . '</td>
                    <td style="' . $color . ' font-size: 6pt;">' . $status . '</td>
                </tr>';
            }
            
            $htmlContent .= '</tbody></table>';
            
            // 9. Write content to PDF
            $pdf->WriteHTML($htmlContent);

            // 10. Set footer for all pages
            $pdf->SetHTMLFooter('<div style="text-align: right; font-size: 10pt; font-weight: bold; padding: 5px 0;">Page {PAGENO} of {nbpg}</div>');

            // 11. Output PDF document
            $fileName = 'Franchise_Report_' . date('Y-m-d-H-i-s') . '.pdf';
            $pdf->Output($fileName, 'D'); // 'D' for download, 'I' for inline display
            
            exit;
            
        } catch (Exception $e) {
            error_log('generateFranchisePDF error: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Generates the HTML header for the PDF.
     */
    // private function generatePdfHeader(string $leftLogo, string $rightLogo): string {
    //     return '
    //         <table width="100%" align="center" style="width: 100%; font-family: calibri; vertical-align: middle;text-align: center;" cellpadding="0" cellspacing="0">
    //             <tr>
    //                 <td style="width: 20%; text-align: left;"><img src="data:image/jpg;base64,' . $leftLogo . '" width="70" /></td>
    //                 <td style="width: 60%; text-align: center;">
    //                     <div style="font-size: 9pt; line-height: 0.75;">REPUBLIC OF THE PHILIPPINES</div>
    //                     <div style="font-size: 11pt; font-weight: bold; line-height: 0.75;">PROVINCE OF DAVAO DEL SUR</div>
    //                     <div style="font-size: 16pt; font-weight: bold; line-height: 1.2;">MUNICIPALITY OF SANTA CRUZ</div>
    //                 </td>
    //                 <td style="width: 20%; text-align: right;"><img src="data:image/jpg;base64,' . $rightLogo . '" width="70" /></td>
    //             </tr>
    //         </table>
    //         <hr style="margin-bottom: 10px;margin-top:10px;" />';
    // }

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
                CONCAT(a.FirstName,' ',a.LastName) as ApplicantName,
                a.ContactNo,
                a.Address,
                m.Name as MakeName,
                CONCAT(u1.FirstName, ' ', u1.LastName) as CreatedByName,
                CONCAT(u2.FirstName, ' ', u2.LastName) as UpdatedByName
            FROM franchises f
            LEFT JOIN applicants a ON a.id = f.ApplicantID
            LEFT JOIN makes m ON f.MakeID = m.id
            LEFT JOIN users u1 ON f.CreatedBy = u1.UserID
            LEFT JOIN users u2 ON f.UpdatedBy = u2.UserID
            WHERE f.id = ?",
            [$id]
        );

        return $franchise ?? [];
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