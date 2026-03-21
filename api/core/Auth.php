<?php
declare(strict_types=1);

namespace App\core;

class Auth {
    public static function hashPassword(string $password): string {
        return password_hash($password, PASSWORD_ARGON2ID, [
            'memory_cost' => 65536,
            'time_cost' => 4,
            'threads' => 3
        ]);
    }
    
    public static function verifyPassword(string $password, string $hash): bool {
        return password_verify($password, $hash);
    }
    
    public static function generateToken(string $userID): string {
        $header = json_encode(['typ' => 'JWT', 'alg' => JWT_ALGORITHM]);
        $payload = json_encode([
            'sub' => $userID,
            'iat' => time(),
            'exp' => time() + JWT_EXPIRY
        ]);
        
        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode($payload);
        
        $signature = hash_hmac('sha256', 
            $base64UrlHeader . '.' . $base64UrlPayload, 
            JWT_SECRET, 
            true
        );
        $base64UrlSignature = self::base64UrlEncode($signature);
        
        return $base64UrlHeader . '.' . $base64UrlPayload . '.' . $base64UrlSignature;
    }
    
    public static function verifyToken(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }
        
        [$header, $payload, $signature] = $parts;
        
        $validSignature = hash_hmac('sha256',
            $header . '.' . $payload,
            JWT_SECRET,
            true
        );
        
        if (!hash_equals(self::base64UrlEncode($validSignature), $signature)) {
            return null;
        }
        
        $payloadData = json_decode(self::base64UrlDecode($payload), true);
        
        if (!$payloadData || $payloadData['exp'] < time()) {
            return null;
        }
        
        return $payloadData;
    }
    
    public static function generateRefreshToken(): string {
        return bin2hex(random_bytes(32));
    }
    
    public static function generateVerificationToken(): string {
        return strtoupper(bin2hex(random_bytes(4)));
    }

    public static function user(): ?array {
        $userID = $GLOBALS['authenticated_user'] ?? '';
        
        if($userID == ''){
            $userID = self::getCurrentUserID();
        }

        $data = Database::fetch("SELECT * FROM users where UserID = ? LIMIT 1",[$userID]);

        return $data ?? null;
    }

    public static function id(): string {
        $userID = $GLOBALS['authenticated_user'] ?? '';
        
        if($userID == ''){
            $userID = self::getCurrentUserID();
        }

        return $userID ?? null;
    }
    
    public static function getCurrentUserID(): ?string {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        
        if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            return null;
        }
        
        $token = $matches[1];
        $payload = self::verifyToken($token);
        
        return $payload['sub'] ?? null;
    }
    
    public static function checkRateLimit(string $key, int $limit, int $window): bool
    {
        // Define your custom cache directory (e.g. /storage/cache/rate_limit)
        $cacheDir = RATE_LIMIT_CACHE_PATH; // Now defined in config.php

        // Ensure the directory exists
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0775, true);
        }

        // Use hashed key to make filename safe
        $cacheFile = $cacheDir . '/rate_limit_' . md5($key) . '.json';

        // Load existing data
        $data = [];
        if (file_exists($cacheFile)) {
            $content = file_get_contents($cacheFile);
            $data = json_decode($content, true) ?? [];
        }

        $now = time();
        // Filter out timestamps older than the time window
        $data = array_filter($data, fn($timestamp) => $timestamp > $now - $window);

        // If limit exceeded, return false
        if (count($data) >= $limit) {
            return false;
        }

        // Add current timestamp and save
        $data[] = $now;
        file_put_contents($cacheFile, json_encode($data));

        return true;
    }

    
    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}