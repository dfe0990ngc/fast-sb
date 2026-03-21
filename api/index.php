<?php
declare(strict_types=1);

// Set CORS headers first to ensure even error responses are accessible by the frontend.
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400'); // Optional: Cache preflight requests for 24 hours

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
// --- CORS Configuration END ---

require_once __DIR__ . '/vendor/autoload.php';

try {
    require_once __DIR__ . '/config.php';
} catch (Dotenv\Exception\InvalidPathException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Configuration error: The .env file is missing or could not be read. Please ensure it exists in the project root.'
    ]);
    exit;
}

use App\core\Router;
use App\middleware\AuthMiddleware;
use App\controllers\AuthController;
use App\controllers\MakeController;
use App\controllers\UserController;
use App\controllers\SettingsController;
use App\controllers\DashboardController;
use App\controllers\FranchiseController;
use App\controllers\ApplicantController;

$router = new Router();

// Set the base path prefix - all routes will now be prefixed with this
$router->setBasePath('/fast-sb');

// Maintenance
$router->get('/api/clear-rate-limit-cache', [AuthController::class, 'clearRateLimitCache']);
$router->get('/api/clear-expired-tokens', [AuthController::class, 'clearExpiredTokensAndLoginAttempts']);

// Public routes
$router->post('/api/auth/login', [AuthController::class, 'login']);

// Protected routes (require authentication)
$router->post('/api/auth/register', [AuthController::class, 'register'],[AuthMiddleware::class]);
$router->post('/api/auth/change-password', [AuthController::class, 'resetPassword'],[AuthMiddleware::class]);
$router->post('/api/auth/logout', [AuthController::class, 'logout'], [AuthMiddleware::class]);
$router->post('/api/auth/refresh', [AuthController::class, 'refresh']);

// Dashboard
$router->get('/api/dashboard', [DashboardController::class,'index'],[AuthMiddleware::class]);
$router->get('/api/dashboard/stats', [DashboardController::class,'stats'],[AuthMiddleware::class]);
$router->get('/api/dashboard/trends', [DashboardController::class,'trends'],[AuthMiddleware::class]);
$router->get('/api/dashboard/status-distribution', [DashboardController::class,'statusDistribution'],[AuthMiddleware::class]);
$router->get('/api/dashboard/top-routes', [DashboardController::class,'topRoutes'],[AuthMiddleware::class]);
$router->get('/api/dashboard/top-makes', [DashboardController::class,'topMakes'],[AuthMiddleware::class]);
$router->get('/api/dashboard/recent-activities', [DashboardController::class,'recentActivities'],[AuthMiddleware::class]);
$router->get('/api/dashboard/expiring-franchises', [DashboardController::class,'expiringFranchises'],[AuthMiddleware::class]);
$router->get('/api/dashboard/route-performance', [DashboardController::class,'routePerformance'],[AuthMiddleware::class]);
$router->get('/api/dashboard/monthly-comparison', [DashboardController::class,'monthlyComparison'],[AuthMiddleware::class]);

// Franchise routes (require authentication)
$router->get('/api/franchises', [FranchiseController::class, 'index'], [AuthMiddleware::class]);
$router->get('/api/franchises/{id}', [FranchiseController::class, 'show'], [AuthMiddleware::class]);
$router->post('/api/franchises', [FranchiseController::class, 'create'], [AuthMiddleware::class]);
$router->put('/api/franchises/{id}', [FranchiseController::class, 'update'], [AuthMiddleware::class]);
$router->delete('/api/franchises/{id}', [FranchiseController::class, 'delete'], [AuthMiddleware::class]);
$router->post('/api/franchises/{id}/renew', [FranchiseController::class, 'renew'], [AuthMiddleware::class]);
$router->post('/api/franchises/{id}/drop', [FranchiseController::class, 'drop'], [AuthMiddleware::class]);
$router->get('/api/franchises/{id}/history', [FranchiseController::class, 'getHistory'], [AuthMiddleware::class]);
$router->get('/api/franchises/statistics/{year}', [FranchiseController::class, 'statistics'], [AuthMiddleware::class]);
$router->get('/api/franchises/export/pdf', [FranchiseController::class, 'exportPDF'], [AuthMiddleware::class]);
$router->get('/api/franchises/export/summary-by-route/pdf', [FranchiseController::class, 'exportSummaryByRoutePDF'], [AuthMiddleware::class]);
$router->get('/api/franchises/{id}/export-form', [FranchiseController::class,'exportFranchiseForm'],[AuthMiddleware::class]);

// Applicant Routes (require authentication)
$router->get('/api/applicants', [ApplicantController::class, 'index'], [AuthMiddleware::class]);
$router->post('/api/applicants', [ApplicantController::class, 'create'], [AuthMiddleware::class]);
$router->get('/api/applicants/{id}', [ApplicantController::class, 'show'], [AuthMiddleware::class]);
$router->put('/api/applicants/{id}', [ApplicantController::class, 'update'], [AuthMiddleware::class]);
$router->delete('/api/applicants/{id}', [ApplicantController::class, 'delete'], [AuthMiddleware::class]);

// Make routes (require authentication)
$router->get('/api/makes', [MakeController::class, 'indexJSON'], [AuthMiddleware::class]);
$router->get('/api/make-list', [MakeController::class, 'index'], [AuthMiddleware::class]);
$router->post('/api/makes', [MakeController::class, 'create'], [AuthMiddleware::class]);
$router->put('/api/makes/{id}', [MakeController::class, 'update'], [AuthMiddleware::class]);
$router->delete('/api/makes/{id}', [MakeController::class, 'delete'], [AuthMiddleware::class]);

// Users routes (require authentication)
$router->get('/api/users', [UserController::class, 'index'], [AuthMiddleware::class]);
$router->post('/api/users', [UserController::class, 'create'], [AuthMiddleware::class]);
$router->put('/api/users/{id}', [UserController::class, 'update'], [AuthMiddleware::class]);
$router->delete('/api/users/{id}', [UserController::class, 'delete'], [AuthMiddleware::class]);

// Profile routes (require authentication)
$router->get('/api/my-profile', [UserController::class, 'getProfile'], [AuthMiddleware::class]);
$router->put('/api/my-profile', [UserController::class, 'updateProfile'], [AuthMiddleware::class]);

// Settings routes (require authentication)
$router->get('/api/settings/export-backup', [SettingsController::class, 'exportBackup'], [AuthMiddleware::class]);
$router->post('/api/settings/clear-caches', [SettingsController::class, 'clearCaches'], [AuthMiddleware::class]);
$router->post('/api/settings/clear-logs', [SettingsController::class, 'clearLogs'], [AuthMiddleware::class]);


// Welcome screen
$router->get('/api/welcome-stats', [DashboardController::class, 'welcomeStats']);
try {
    $router->dispatch();
} catch (Throwable $e) {
    // Always log errors regardless of debug mode
    error_log('=== APPLICATION ERROR ===');
    error_log('Message: ' . $e->getMessage());
    error_log('File: ' . $e->getFile());
    error_log('Line: ' . $e->getLine());
    error_log('Trace: ' . $e->getTraceAsString());
    error_log('========================');
    
    http_response_code(500);
    
    $errorResponse = [
        'success' => false,
        'message' => 'Internal server error'
    ];
    
    if (DEBUG_MODE) {
        $errorResponse['error'] = [
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => explode("\n", $e->getTraceAsString())
        ];
    } else {
        $errorResponse['error'] = 'An unexpected error occurred.';
    }
    
    echo json_encode($errorResponse);
}