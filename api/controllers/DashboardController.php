<?php
declare(strict_types=1);

namespace App\controllers;

use App\core\Database;
use Exception;

class DashboardController extends Controller {
    
    // GET: Dashboard overview statistics
    public function index(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        try {
            $year = $_GET['year'] ?? date('Y');
            $isAllTime = ($year === '0' || $year === 'all');
            
            $currentMonth = $_GET['month'] ?? date('m');
            if($currentMonth == '0'){
                $currentMonth = '';
            }
            
            // Get all stats in parallel queries
            $stats = $this->getOverviewStats($year, $currentMonth, $isAllTime);
            $trends = $this->getFranchiseTrends($year, 12, $isAllTime);
            $statusDistribution = $this->getStatusDistribution($year, $isAllTime);
            $topRoutes = $this->getTopRoutes($year, 10, $isAllTime);
            $topMakes = $this->getTopMakes($year, 10, $isAllTime);
            $recentActivities = $this->getRecentActivities();
            $userAnalytics = $this->getUserAnalytics();
            $monthlyStats = $this->getMonthlyStats($year, $isAllTime);

            // Also fetch available years to populate filters without a separate API call
            $availableYears = Database::fetchAll(
                "SELECT DISTINCT YEAR(DateIssued) as year
                FROM franchise_history
                WHERE YEAR(DateIssued) IS NOT NULL AND YEAR(DateIssued) > 0
                ORDER BY year DESC"
            );
            
            $this->response(true, 'Dashboard data retrieved successfully', [
                'stats' => $stats,
                'trends' => $trends,
                'status_distribution' => $statusDistribution,
                'top_routes' => $topRoutes,
                'top_makes' => $topMakes,
                'recent_activities' => $recentActivities,
                'user_analytics' => $userAnalytics,
                'monthly_stats' => $monthlyStats,
                'year' => $year,
                'available_years' => array_column($availableYears, 'year')
            ]);
        } catch (Exception $e) {
            error_log('Dashboard data error: ' . $e->getMessage());
            $this->response(false, 'Failed to retrieve dashboard data', [], 500);
        }
    }
    
    // GET: Overview statistics
    public function stats(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        $year = $_GET['year'] ?? date('Y');
        $isAllTime = ($year === '0' || $year === 'all');
        $month = $_GET['month'] ?? date('m');
        
        try {
            $stats = $this->getOverviewStats($year, $month, $isAllTime);
            
            $this->response(true, 'Statistics retrieved successfully', $stats);
        } catch (Exception $e) {
            error_log('Stats retrieval error: ' . $e->getMessage());
            $this->response(false, 'Failed to retrieve statistics', [], 500);
        }
    }
    
    // GET: Franchise trends over time
    public function trends(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        $year = $_GET['year'] ?? date('Y');
        $isAllTime = ($year === '0' || $year === 'all');
        $months = (int)($_GET['months'] ?? 6);
        
        try {
            $trends = $this->getFranchiseTrends($year, $months, $isAllTime);
            
            $this->response(true, 'Trends retrieved successfully', [
                'trends' => $trends,
                'year' => $year
            ]);
        } catch (Exception $e) {
            error_log('Trends retrieval error: ' . $e->getMessage());
            $this->response(false, 'Failed to retrieve trends', [], 500);
        }
    }
    
    // GET: Status distribution
    public function statusDistribution(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        $year = $_GET['year'] ?? date('Y');
        $isAllTime = ($year === '0' || $year === 'all');
        
        try {
            $distribution = $this->getStatusDistribution($year, $isAllTime);
            
            $this->response(true, 'Status distribution retrieved successfully', [
                'distribution' => $distribution
            ]);
        } catch (Exception $e) {
            error_log('Status distribution error: ' . $e->getMessage());
            $this->response(false, 'Failed to retrieve status distribution', [], 500);
        }
    }
    
    // GET: Top routes
    public function topRoutes(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        $year = $_GET['year'] ?? date('Y');
        $isAllTime = ($year === '0' || $year === 'all');
        $limit = (int)($_GET['limit'] ?? 10);
        
        try {
            $routes = $this->getTopRoutes($year, $limit, $isAllTime);
            
            $this->response(true, 'Top routes retrieved successfully', [
                'routes' => $routes
            ]);
        } catch (Exception $e) {
            error_log('Top routes error: ' . $e->getMessage());
            $this->response(false, 'Failed to retrieve top routes', [], 500);
        }
    }
    
    // GET: Top makes/brands
    public function topMakes(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        $year = $_GET['year'] ?? date('Y');
        $isAllTime = ($year === '0' || $year === 'all');
        $limit = (int)($_GET['limit'] ?? 10);
        
        try {
            $makes = $this->getTopMakes($year, $limit, $isAllTime);
            
            $this->response(true, 'Top makes retrieved successfully', [
                'makes' => $makes
            ]);
        } catch (Exception $e) {
            error_log('Top makes error: ' . $e->getMessage());
            $this->response(false, 'Failed to retrieve top makes', [], 500);
        }
    }
    
    // GET: Recent activities
    public function recentActivities(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        $limit = (int)($_GET['limit'] ?? 10);
        
        try {
            $activities = $this->getRecentActivities($limit);
            
            $this->response(true, 'Recent activities retrieved successfully', [
                'activities' => $activities
            ]);
        } catch (Exception $e) {
            error_log('Recent activities error: ' . $e->getMessage());
            $this->response(false, 'Failed to retrieve recent activities', [], 500);
        }
    }
    
    // GET: Expiring franchises
    public function expiringFranchises(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        $days = (int)($_GET['days'] ?? 30);
        $limit = (int)($_GET['limit'] ?? 20);
        
        try {
            $expiring = $this->getExpiringFranchises($days, $limit);
            
            $this->response(true, 'Expiring franchises retrieved successfully', [
                'franchises' => $expiring,
                'days_threshold' => $days,
                'total' => count($expiring)
            ]);
        } catch (Exception $e) {
            error_log('Expiring franchises error: ' . $e->getMessage());
            $this->response(false, 'Failed to retrieve expiring franchises', [], 500);
        }
    }
    
    // GET: Route performance analysis
    public function routePerformance(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        $year = $_GET['year'] ?? date('Y');
        $isAllTime = ($year === '0' || $year === 'all');
        
        try {
            $performance = $this->getRoutePerformance($year, $isAllTime);
            
            $this->response(true, 'Route performance retrieved successfully', [
                'performance' => $performance,
                'year' => $year
            ]);
        } catch (Exception $e) {
            error_log('Route performance error: ' . $e->getMessage());
            $this->response(false, 'Failed to retrieve route performance', [], 500);
        }
    }
    
    // GET: Monthly comparison
    public function monthlyComparison(): void {
        $this->checkPermission(['Admin', 'Editor', 'Viewer']);
        
        $year = $_GET['year'] ?? date('Y');
        $isAllTime = ($year === '0' || $year === 'all');
        
        try {
            $comparison = $this->getMonthlyStats($year, $isAllTime);
            
            $this->response(true, 'Monthly comparison retrieved successfully', [
                'comparison' => $comparison,
                'year' => $year
            ]);
        } catch (Exception $e) {
            error_log('Monthly comparison error: ' . $e->getMessage());
            $this->response(false, 'Failed to retrieve monthly comparison', [], 500);
        }
    }
    
    // GET: Welcome screen statistics
    public function welcomeStats(): void {

        try {
            $stats = $this->getWelcomeScreenStats();
            
            $this->response(true, 'Welcome screen statistics retrieved successfully', $stats);
        } catch (Exception $e) {
            error_log('Welcome screen stats retrieval error: ' . $e->getMessage());
            $this->response(false, 'Failed to retrieve welcome screen statistics', ['err' => $e->getMessage()], 500);
        }
    }
    
    // ==================================================
    // PRIVATE HELPER METHODS
    // ==================================================
    
    private function getOverviewStats(string $year, string $month, bool $isAllTime = false): array {

        if ($isAllTime) {
            // For all-time, compare current year vs previous year
            $currentYear = date('Y');
            $prevYear = $currentYear - 1;
            
            $prevYearTotal = Database::fetch(
                "SELECT COUNT(*) as count FROM franchise_history WHERE YEAR(DateIssued) = ?",
                [$prevYear]
            )['count'] ?? 0;
            
            // All-time stats (no year filter)
            if($month == ''){
                $totalFranchises = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE Status != 'drop'"
                )['count'] ?? 0;

                $activeRoutes = Database::fetch(
                    "SELECT COUNT(DISTINCT Route) as count FROM franchises WHERE Status != 'drop'"
                )['count'] ?? 0;
                
                $renewalsThisMonth = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE Status = 'renew'"
                )['count'] ?? 0;
                
                $droppedFranchises = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE Status = 'drop'"
                )['count'] ?? 0;
            } else {
                // All-time but filtered by specific month across all years
                $totalFranchises = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE MONTH(DateIssued) = ? AND Status != 'drop'",
                    [$month]
                )['count'] ?? 0;

                $activeRoutes = Database::fetch(
                    "SELECT COUNT(DISTINCT Route) as count FROM franchises WHERE Status != 'drop' AND MONTH(DateIssued) = ?",
                    [$month]
                )['count'] ?? 0;

                $renewalsThisMonth = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE Status = 'renew' AND MONTH(DateIssued) = ?",
                    [$month]
                )['count'] ?? 0;
                
                $droppedFranchises = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE Status = 'drop' AND MONTH(DateIssued) = ?",
                    [$month]
                )['count'] ?? 0;
            }
            
            $prevYearRenewals = Database::fetch(
                "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE Status = 'renew' AND YEAR(DateIssued) = ?",
                [$prevYear]
            )['count'] ?? 0;
            
            $prevYearDropped = Database::fetch(
                "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE Status = 'drop' AND YEAR(DateIssued) = ?",
                [$prevYear]
            )['count'] ?? 0;
            
        } else {
            // Original year-specific logic
            $prevYear = $year - 1;
            $prevYearTotal = Database::fetch(
                "SELECT COUNT(*) as count FROM franchises WHERE YEAR(DateIssued) = ? AND Status != 'drop'",
                [$prevYear]
            )['count'] ?? 0;
            
            // Renewals this month/year
            if($month == ''){
                $totalFranchises = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE YEAR(DateIssued) = ?",
                    [$year]
                )['count'] ?? 0;

                $activeRoutes = Database::fetch(
                    "SELECT COUNT(DISTINCT Route) as count FROM franchises WHERE Status != 'drop' AND YEAR(DateIssued) = ?",
                    [$year]
                )['count'] ?? 0;
                
                $renewalsThisMonth = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises
                     WHERE Status = 'renew' AND YEAR(DateIssued) = ?",
                    [$year]
                )['count'] ?? 0;
                
                $droppedFranchises = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE Status = 'drop' AND YEAR(DateIssued) = ?",
                    [$year]
                )['count'] ?? 0;
            }else{
                
                $totalFranchises = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE YEAR(DateIssued) = ? AND MONTH(DateIssued) = ?",
                    [$year, $month]
                )['count'] ?? 0;

                $activeRoutes = Database::fetch(
                    "SELECT COUNT(DISTINCT Route) as count FROM franchises WHERE Status != 'drop' AND YEAR(DateIssued) = ? AND MONTH(DateIssued) = ?",
                    [$year, $month]
                )['count'] ?? 0;

                $renewalsThisMonth = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises
                     WHERE Status = 'renew' AND YEAR(DateIssued) = ? AND MONTH(DateIssued) = ?",
                    [$year,$month]
                )['count'] ?? 0;
                
                $droppedFranchises = Database::fetch(
                    "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE Status = 'drop' AND YEAR(DateIssued) = ? AND MONTH(DateIssued) = ?",
                    [$year, $month]
                )['count'] ?? 0;
            }
            
            $prevYearRenewals = Database::fetch(
                "SELECT COUNT(DISTINCT id) as count FROM franchises
                 WHERE Status = 'renew' AND YEAR(DateIssued) = ?",
                [$prevYear]
            )['count'] ?? 0;
            
            $prevYearDropped = Database::fetch(
                "SELECT COUNT(DISTINCT id) as count FROM franchises WHERE Status = 'drop' AND YEAR(DateIssued) = ?",
                [$prevYear]
            )['count'] ?? 0;
        }
        
        // Calculate percentage changes
        $franchiseChange = $prevYearTotal > 0
            ? round((($totalFranchises - $prevYearTotal) / $prevYearTotal) * 100, 1)
            : ($totalFranchises > 0 ? 100 : 0);
            
        $renewalChange = $prevYearRenewals > 0
            ? round((($renewalsThisMonth - $prevYearRenewals) / $prevYearRenewals) * 100, 1)
            : ($renewalsThisMonth > 0 ? 100 : 0);
            
        $dropChange = $prevYearDropped > 0 
            ? round((($droppedFranchises - $prevYearDropped) / $prevYearDropped) * 100, 1)
            : ($droppedFranchises > 0 ? 100 : 0);
        
        return [
            'total_franchises' => [
                'value' => $totalFranchises,
                'change' => $franchiseChange,
                'trend' => $franchiseChange >= 0 ? 'up' : 'down'
            ],
            'active_routes' => [
                'value' => $activeRoutes,
                'change' => 5,
                'trend' => 'up'
            ],
            'renewals_this_month' => [
                'value' => $renewalsThisMonth,
                'change' => $renewalChange,
                'trend' => $renewalChange >= 0 ? 'up' : 'down'
            ],
            'dropped_franchises' => [
                'value' => $droppedFranchises,
                'change' => abs($dropChange),
                'trend' => $dropChange <= 0 ? 'up' : 'down'
            ]
        ];
    }
    
    private function getUserAnalytics(int $limit = 5): array {
        $sql = "SELECT
                    u.UserID,
                    CONCAT(u.FirstName, ' ', u.LastName) as user_name,
                    COUNT(fh.id) as total_actions,
                    SUM(CASE WHEN fh.ActionType = 'new' THEN 1 ELSE 0 END) as new_count,
                    SUM(CASE WHEN fh.ActionType = 'renew' THEN 1 ELSE 0 END) as renew_count,
                    SUM(CASE WHEN fh.ActionType = 'update' THEN 1 ELSE 0 END) as update_count,
                    SUM(CASE WHEN fh.ActionType = 'drop' THEN 1 ELSE 0 END) as drop_count
                FROM franchise_history fh
                JOIN users u ON fh.CreatedBy = u.UserID
                GROUP BY u.UserID, user_name
                ORDER BY total_actions DESC
                LIMIT ?";
        
        $analytics = Database::fetchAll($sql, [$limit]);

        return array_map(function($row) {
            return [
                'user_name' => $row['user_name'],
                'total_actions' => (int)$row['total_actions'],
                'actions_breakdown' => [
                    'added' => (int)$row['new_count'],
                    'renewed' => (int)$row['renew_count'],
                    'updated' => (int)$row['update_count'],
                    'dropped' => (int)$row['drop_count'],
                ]
            ];
        }, $analytics);
    }

    private function getFranchiseTrends(string $year, int $months = 12, bool $isAllTime = false): array {
        if ($isAllTime) {
            // Get trends across all years, grouped by month
            $sql = "SELECT 
                        MONTH(DateIssued) as month,
                        MONTHNAME(DateIssued) as month_name,
                        SUM(CASE WHEN ActionType = 'new' THEN 1 ELSE 0 END) as new_count,
                        SUM(CASE WHEN ActionType = 'renew' THEN 1 ELSE 0 END) as renew_count,
                        SUM(CASE WHEN ActionType = 'drop' THEN 1 ELSE 0 END) as drop_count
                    FROM franchise_history
                    GROUP BY MONTH(DateIssued), MONTHNAME(DateIssued)
                    ORDER BY MONTH(DateIssued)
                    LIMIT ?";
            
            $trends = Database::fetchAll($sql, [$months]);
        } else {
            // Original year-specific query
            $sql = "SELECT 
                        MONTH(DateIssued) as month,
                        MONTHNAME(DateIssued) as month_name,
                        SUM(CASE WHEN ActionType = 'new' THEN 1 ELSE 0 END) as new_count,
                        SUM(CASE WHEN ActionType = 'renew' THEN 1 ELSE 0 END) as renew_count,
                        SUM(CASE WHEN ActionType = 'drop' THEN 1 ELSE 0 END) as drop_count
                    FROM franchise_history
                    WHERE YEAR(DateIssued) = ?
                    GROUP BY MONTH(DateIssued), MONTHNAME(DateIssued)
                    ORDER BY MONTH(DateIssued)
                    LIMIT ?";
            
            $trends = Database::fetchAll($sql, [$year, $months]);
        }
        
        // Format for frontend
        return array_map(function($row) {
            return [
                'month' => substr($row['month_name'], 0, 3),
                'new' => (int)$row['new_count'],
                'renew' => (int)$row['renew_count'],
                'drop' => (int)$row['drop_count']
            ];
        }, $trends);
    }
    
    private function getStatusDistribution(string $year, bool $isAllTime = false): array {
        if ($isAllTime) {
            $sql = "SELECT 
                        Status,
                        COUNT(DISTINCT id) as count
                    FROM franchises
                    GROUP BY Status";
            
            $distribution = Database::fetchAll($sql);
        } else {
            $sql = "SELECT 
                        Status,
                        COUNT(DISTINCT id) as count
                    FROM franchises
                    WHERE YEAR(DateIssued) = ?
                    GROUP BY Status";
            
            $distribution = Database::fetchAll($sql, [$year]);
        }
        
        $total = array_sum(array_column($distribution, 'count'));
        
        return array_map(function($row) use ($total) {
            return [
                'name' => ucfirst($row['Status']),
                'value' => (int)$row['count'],
                'percentage' => $total > 0 ? round(($row['count'] / $total) * 100, 1) : 0,
            ];
        }, $distribution);
    }
    
    private function getTopRoutes(string $year, int $limit = 10, bool $isAllTime = false): array {
        if ($isAllTime) {
            $sql = "SELECT 
                        fh.Route,
                        COUNT(DISTINCT fh.FranchiseID) as franchise_count,
                        m.Name as primary_make,
                        ROUND((COUNT(DISTINCT CASE WHEN fh.NewStatus != 'drop' THEN fh.FranchiseID END) / COUNT(DISTINCT fh.FranchiseID)) * 100, 0) as utilization
                    FROM franchise_history fh
                    LEFT JOIN franchises f ON fh.FranchiseID = f.id
                    LEFT JOIN makes m ON f.MakeID = m.id
                    WHERE fh.Route IS NOT NULL AND fh.Route != ''
                    GROUP BY fh.Route, m.Name
                    ORDER BY franchise_count DESC
                    LIMIT ?";
            
            $routes = Database::fetchAll($sql, [$limit]);
        } else {
            $sql = "SELECT 
                        fh.Route,
                        COUNT(DISTINCT fh.FranchiseID) as franchise_count,
                        m.Name as primary_make,
                        ROUND((COUNT(DISTINCT CASE WHEN fh.NewStatus != 'drop' THEN fh.FranchiseID END) / COUNT(DISTINCT fh.FranchiseID)) * 100, 0) as utilization
                    FROM franchise_history fh
                    LEFT JOIN franchises f ON fh.FranchiseID = f.id
                    LEFT JOIN makes m ON f.MakeID = m.id
                    WHERE fh.Route IS NOT NULL AND fh.Route != '' AND YEAR(fh.DateIssued) = ?
                    GROUP BY fh.Route, m.Name
                    ORDER BY franchise_count DESC
                    LIMIT ?";
            
            $routes = Database::fetchAll($sql, [$year, $limit]);
        }
        
        return array_map(function($row) {
            return [
                'name' => $row['Route'],
                'franchises' => (int)$row['franchise_count'],
                'make' => $row['primary_make'] ?? 'Various',
                'utilization' => (int)$row['utilization']
            ];
        }, $routes);
    }
    
    private function getTopMakes(string $year, int $limit = 10, bool $isAllTime = false): array {
        if ($isAllTime) {
            $sql = "SELECT 
                        m.Name as make_name,
                        COUNT(DISTINCT f.id) as count
                    FROM makes m
                    LEFT JOIN (franchises f JOIN franchise_history fh ON f.id = fh.FranchiseID) ON m.id = f.MakeID
                    WHERE m.IsActive = 1
                    GROUP BY m.id, m.Name
                    ORDER BY count DESC
                    LIMIT ?";
            
            $makes = Database::fetchAll($sql, [$limit]);
        } else {
            $sql = "SELECT 
                        m.Name as make_name,
                        COUNT(DISTINCT f.id) as count
                    FROM makes m
                    LEFT JOIN (franchises f JOIN franchise_history fh ON f.id = fh.FranchiseID) ON m.id = f.MakeID
                    WHERE m.IsActive = 1 AND YEAR(fh.DateIssued) = ?
                    GROUP BY m.id, m.Name
                    ORDER BY count DESC
                    LIMIT ?";
            
            $makes = Database::fetchAll($sql, [$year, $limit]);
        }
        
        $total = array_sum(array_column($makes, 'count'));
        
        return array_map(function($row) use ($total) {
            return [
                'name' => $row['make_name'],
                'count' => (int)$row['count'],
                'percentage' => $total > 0 ? round(($row['count'] / $total) * 100, 1) : 0
            ];
        }, $makes);
    }
    
    private function getRecentActivities(int $limit = 10): array {
        $sql = "SELECT 
                    fh.id,
                    fh.ActionType as action_type,
                    fh.CreatedAt as created_at,
                    f.FranchiseNo as franchise_no,
                    CONCAT(a.FirstName, ' ', a.LastName) as franchise_name,
                    CONCAT(u.FirstName, ' ', u.LastName) as user_name,
                    TIMESTAMPDIFF(HOUR, fh.CreatedAt, NOW()) as hours_ago
                FROM franchise_history fh
                LEFT JOIN franchises f ON fh.FranchiseID = f.id
                LEFT JOIN applicants a ON f.ApplicantID = a.id
                LEFT JOIN users u ON fh.CreatedBy = u.UserID
                ORDER BY fh.CreatedAt DESC
                LIMIT ?";
        
        $activities = Database::fetchAll($sql, [$limit]);
        
        return array_map(function($row) {
            $hoursAgo = (int)$row['hours_ago'];
            
            if ($hoursAgo < 1) {
                $timeAgo = 'Just now';
            } elseif ($hoursAgo < 24) {
                $timeAgo = $hoursAgo . ' hour' . ($hoursAgo > 1 ? 's' : '') . ' ago';
            } else {
                $daysAgo = floor($hoursAgo / 24);
                $timeAgo = $daysAgo . ' day' . ($daysAgo > 1 ? 's' : '') . ' ago';
            }
            
            return [
                'id' => (int)$row['id'],
                'user' => $row['user_name'] ?? 'Unknown User',
                'action' => $this->formatAction($row['action_type']),
                'subject' => $row['franchise_no'] ?? 'N/A',
                'franchise_name' => $row['franchise_name'],
                'time' => $timeAgo,
                'type' => $row['action_type']
            ];
        }, $activities);
    }
    
    private function getExpiringFranchises(int $days, int $limit): array {
        $sql = "SELECT 
                    f.id,
                    f.FranchiseNo,
                    CONCAT(a.FirstName, ' ', a.LastName) as Name,
                    f.Route,
                    f.ExpiryDate,
                    a.ContactNo,
                    m.Name as MakeName,
                    DATEDIFF(f.ExpiryDate, CURDATE()) as days_remaining
                FROM franchises f
                LEFT JOIN applicants a ON f.ApplicantID = a.id
                LEFT JOIN makes m ON f.MakeID = m.id
                WHERE f.ExpiryDate IS NOT NULL
                  AND f.Status != 'drop'
                  AND f.ExpiryDate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
                ORDER BY f.ExpiryDate ASC
                LIMIT ?";
        
        return Database::fetchAll($sql, [$days, $limit]);
    }
    
    private function getRoutePerformance(string $year, bool $isAllTime = false): array {
        if ($isAllTime) {
            $sql = "SELECT 
                        Route,
                        COUNT(*) as total_franchises,
                        SUM(CASE WHEN ActionType = 'new' THEN 1 ELSE 0 END) as new_count,
                        SUM(CASE WHEN ActionType = 'renew' THEN 1 ELSE 0 END) as renew_count,
                        SUM(CASE WHEN ActionType = 'drop' THEN 1 ELSE 0 END) as drop_count,
                        ROUND((SUM(CASE WHEN ActionType = 'renew' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) as renewal_rate
                    FROM franchise_history
                    GROUP BY Route
                    ORDER BY total_franchises DESC";
            
            return Database::fetchAll($sql);
        } else {
            $sql = "SELECT 
                        Route,
                        COUNT(*) as total_franchises,
                        SUM(CASE WHEN ActionType = 'new' THEN 1 ELSE 0 END) as new_count,
                        SUM(CASE WHEN ActionType = 'renew' THEN 1 ELSE 0 END) as renew_count,
                        SUM(CASE WHEN ActionType = 'drop' THEN 1 ELSE 0 END) as drop_count,
                        ROUND((SUM(CASE WHEN ActionType = 'renew' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) as renewal_rate
                    FROM franchise_history
                    WHERE YEAR(DateIssued) = ?
                    GROUP BY Route
                    ORDER BY total_franchises DESC";
            
            return Database::fetchAll($sql, [$year]);
        }
    }
    
    private function getMonthlyStats(string $year, bool $isAllTime = false): array {
        if ($isAllTime) {
            $sql = "SELECT 
                        MONTH(DateIssued) as month,
                        MONTHNAME(DateIssued) as month_name,
                        COUNT(DISTINCT FranchiseID) as total,
                        SUM(CASE WHEN ActionType = 'new' THEN 1 ELSE 0 END) as new_count,
                        SUM(CASE WHEN ActionType = 'renew' THEN 1 ELSE 0 END) as renew_count,
                        SUM(CASE WHEN ActionType = 'drop' THEN 1 ELSE 0 END) as drop_count
                    FROM franchise_history
                    GROUP BY MONTH(DateIssued), MONTHNAME(DateIssued)
                    ORDER BY MONTH(DateIssued)";
            
            return Database::fetchAll($sql);
        } else {
            $sql = "SELECT 
                        MONTH(DateIssued) as month,
                        MONTHNAME(DateIssued) as month_name,
                        COUNT(DISTINCT FranchiseID) as total,
                        SUM(CASE WHEN ActionType = 'new' THEN 1 ELSE 0 END) as new_count,
                        SUM(CASE WHEN ActionType = 'renew' THEN 1 ELSE 0 END) as renew_count,
                        SUM(CASE WHEN ActionType = 'drop' THEN 1 ELSE 0 END) as drop_count
                    FROM franchise_history
                    WHERE YEAR(DateIssued) = ?
                    GROUP BY MONTH(DateIssued), MONTHNAME(DateIssued)
                    ORDER BY MONTH(DateIssued)";
            
            return Database::fetchAll($sql, [$year]);
        }
    }
    
    private function getWelcomeScreenStats(): array {
        // Active Franchises
        $activeFranchises = Database::fetch(
            "SELECT COUNT(*) as count FROM franchises WHERE Status != 'drop'"
        )['count'] ?? 0;

        // Number of Routes Covered
        $routesCovered = Database::fetch(
            "SELECT COUNT(DISTINCT Route) as count FROM franchises WHERE Status != 'drop' AND Route IS NOT NULL AND Route != ''"
        )['count'] ?? 0;

        // Number of Vehicle Makes
        $vehicleMakes = Database::fetch(
            "SELECT COUNT(*) as count FROM makes WHERE IsActive = 1"
        )['count'] ?? 0;

        // Compliance Rate (% of non-expired active franchises)
        $nonExpiredCount = Database::fetch(
            "SELECT COUNT(*) as count FROM franchises WHERE Status != 'drop' AND ExpiryDate >= CURDATE()"
        )['count'] ?? 0;
        $complianceRate = $activeFranchises > 0 ? round(($nonExpiredCount / $activeFranchises) * 100, 1) : 100;

        return [
            'stats' => [
                'active_franchises' => (int)$activeFranchises,
                'routes_covered' => (int)$routesCovered,
                'vehicle_makes' => (int)$vehicleMakes,
                'compliance_rate' => (float)$complianceRate,
            ],
        ];
    }
    
    private function formatAction(string $actionType): string {
        $actions = [
            'new' => 'Created new franchise',
            'renew' => 'Renewed franchise',
            'drop' => 'Dropped franchise',
            'update' => 'Updated franchise'
        ];
        
        return $actions[$actionType] ?? 'Modified franchise';
    }
}