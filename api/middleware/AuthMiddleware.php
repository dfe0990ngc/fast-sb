<?php
// middleware/AuthMiddleware.php
declare(strict_types=1);

namespace App\middleware;

use App\core\Auth;

class AuthMiddleware {
    public function handle(): void {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        
        if (!$authHeader) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Authorization token required'
            ]);
            exit;
        }
        
        if (!preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid authorization format'
            ]);
            exit;
        }
        
        $token = $matches[1];
        $payload = Auth::verifyToken($token);
        
        if (!$payload) {
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid or expired token'
            ]);
            exit;
        }
        
        // Store User ID in globals for easy access
        $GLOBALS['authenticated_user'] = $payload['sub'];
    }
}