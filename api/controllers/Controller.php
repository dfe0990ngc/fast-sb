<?php 
declare(strict_types=1);

namespace App\controllers;

use App\core\Auth;
use App\core\Database;

class Controller {

    protected function LogDelete($data, string $modelName = 'default'): void {
        
        $logDir = __DIR__ . '/../storage/logs/deleted';
        if (!is_dir($logDir)) {
            mkdir($logDir, 0775, true);
        }

        $logFile = $logDir . '/'.strtolower($modelName).'.log';
        $timestamp = date('Y-m-d H:i:s');
        $userID = Auth::id();

        $logEntry = sprintf(
            "[%s] %s deleted by UserID %s. Details: %s\n",
            $timestamp,
            ucfirst($modelName),
            $userID,
            json_encode($data, JSON_UNESCAPED_SLASHES)
        );

        file_put_contents($logFile, $logEntry, FILE_APPEND);
    }

    protected function getJsonInput(): array {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
    
    protected function response(bool $success, string $message, array $data = [], int $code = 200): void {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode(array_merge(['success' => $success, 'message' => $message], $data));
        exit;
    }
    
    protected function getAuthenticatedUser(): string {
        return $GLOBALS['authenticated_user'] ?? '';
    }
    
    protected function getUserType(): ?string {
        $userID = $this->getAuthenticatedUser();
        if (!$userID) return null;
        
        $user = Database::fetch(
            "SELECT UserType FROM users WHERE UserID = ?",
            [$userID]
        );
        
        return $user['UserType'] ?? null;
    }
    
    protected function checkPermission(array $allowedTypes): void {
        $userType = $this->getUserType();
        if (!$userType || !in_array($userType, $allowedTypes)) {
            $this->response(false, 'Insufficient permissions', [], 403);
        }
    }
}