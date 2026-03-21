<?php
declare(strict_types=1);

namespace App\controllers;

use App\core\Auth;
use App\core\Validator;
use App\controllers\Controller;
use App\core\Database;

class AuthController extends Controller {    
    public function register(): void {
        $input = $this->getJsonInput();
        
        // Rate limiting
        $ip = $_SERVER['REMOTE_ADDR'];
        if (!Auth::checkRateLimit("register:{$ip}", 5, 3600)) {
            $this->response(false, 'Too many registration attempts. Try again later after an hour.', [], 429);
        }
        
        // Validate input
        $validator = new Validator();
        if (!$validator->validate($input, [
            'UserID' => 'required|alphanumeric',
            'FirstName' => 'required|min:1',
            'LastName' => 'required|min:1',
            'Password' => 'required|min:8',
            'UserType' => 'required|enum:Admin,Editor,Viewer',
        ])) {
            $this->response(false, $validator->getFirstError(), ['errors' => $validator->getErrors()], 422);
        }
        
        // Sanitize inputs
        $userID = Validator::sanitize($input['UserID']);
        $firstName = Validator::sanitize($input['FirstName']);
        $lastName = Validator::sanitize($input['LastName']);
        $userType = Validator::sanitize($input['UserType']);
        // $email = filter_var($input['email'], FILTER_VALIDATE_EMAIL);
        
        // Check if already registered
        $existing = Database::fetch(
            "SELECT UserID FROM users WHERE UserID = ?",
            [$userID]
        );
        
        if ($existing) {
            $this->response(false, 'This user ID already in used', [], 409);
        }
        
        // Create credential record
        $passwordHash = Auth::hashPassword($input['Password']);
        $currentUser = Auth::id();
        
        Database::insert('users', [
            'UserID' => $userID,
            'FirstName' => $firstName,
            'LastName' => $lastName,
            'PasswordHash' => $passwordHash,
            'UserType' => $userType,
            'CreatedAt' => date('Y-m-d H:i:s'),
            'CreatedBy' => $currentUser,
        ]);

        $user = Database::fetch("SELECT * FROM users where UserID = ? LIMIT 1",[$userID]);

        $this->response(true, 'The user has been successfully registered!', [
            'verification_required' => false,
            'user' => $user,
        ], 201);
    }
    
    public function login(): void {
        $input = $this->getJsonInput();
        
        // Rate limiting
        $ip = $_SERVER['REMOTE_ADDR'];
        if (!Auth::checkRateLimit("login:{$ip}", LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW)) {
            $this->response(false, 'Too many login attempts. Try again later.', [], 429);
        }
        
        // Validate
        $validator = new Validator();
        if (!$validator->validate($input, [
            'UserID' => 'required|alphanumeric',
            'Password' => 'required'
        ])) {
            $this->response(false, $validator->getFirstError(), [], 422);
        }
        
        // $email = filter_var($input['email'], FILTER_VALIDATE_EMAIL);
        $userID = Validator::sanitize($input['UserID']);
        
        // Fetch user
        $user = Database::fetch("SELECT * FROM users WHERE UserID = ?",[$userID]);
        
        if (!$user || !Auth::verifyPassword($input['Password'], $user['PasswordHash'])) {
            $this->response(false, 'Invalid user ID or password', [], 401);
        }
        
        // Generate tokens
        $accessToken = Auth::generateToken($user['UserID']);
        $refreshToken = Auth::generateRefreshToken();
        
        // Store refresh token
        Database::insert('refresh_tokens', [
            'UserID' => $user['UserID'],
            'Token' => hash('sha256', $refreshToken),
            'ExpiresAt' => date('Y-m-d H:i:s', time() + REFRESH_TOKEN_EXPIRY),
            'CreatedAt' => date('Y-m-d H:i:s')
        ]);
        
        // Update last login
        Database::update(
            'users',
            ['LastLogin' => date('Y-m-d H:i:s')],
            'UserID = :user_id',
            ['user_id' => $user['UserID']]
        );

        // Fetch available years to populate filters
        $availableYears = Database::fetchAll(
            "SELECT DISTINCT YEAR(DateIssued) as year 
            FROM franchises 
            WHERE YEAR(DateIssued) IS NOT NULL AND YEAR(DateIssued) > 0
            ORDER BY year DESC"
        );

        // Add 'all' option at the beginning
        array_unshift($availableYears, ['year' => 'all']);
        
        $this->response(true, 'Login successful', [
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'token_type' => 'Bearer',
            'expires_in' => JWT_EXPIRY,
            'UserID' => $user['UserID'],
            'available_years' => array_column($availableYears, 'year'),
            'user' => [
                'id' => $user['id'],
                'UserID' => $user['UserID'],
                'FirstName' => $user['FirstName'],
                'LastName' => $user['LastName'],
                'UserType' => $user['UserType'],
                'LastLogin' => date('Y-m-d H:i:s'),
            ],
        ]);
    }
    
    public function resetPassword(): void {
        $input = $this->getJsonInput();
        
        $validator = new Validator();
        if (!$validator->validate($input, [
            'OldPassword' => 'required',
            'Password' => 'required|min:6',
            'PasswordConfirmation' => 'required|same:Password'
        ])) {
            $this->response(false, $validator->getFirstError(), [], 422);
        }
        
        $oldPassword = Validator::sanitize($input['OldPassword']);

        $user = Auth::user();
        
        if (!$user || !Auth::verifyPassword($oldPassword, $user['PasswordHash'])) {
            $this->response(false, 'Invalid old password', [], 403);
        }
        
        $passwordHash = Auth::hashPassword($input['Password']);
        
        Database::update(
            'users',
            [
                'PasswordHash' => $passwordHash,
            ],
            'UserID = :userID',
            ['userID' => $user['UserID']]
        );
        
        $this->response(true, 'Password has been reset successfully');
    }
    
    public function refresh(): void {
        $input = $this->getJsonInput();
        
        $validator = new Validator();
        if (!$validator->validate($input, ['refresh_token' => 'required'])) {
            $this->response(false, $validator->getFirstError(), [], 422);
        }
        
        $refreshToken = $input['refresh_token'];
        $tokenHash = hash('sha256', $refreshToken);
        
        // Fetch the refresh token
        $token = Database::fetch(
            "SELECT UserID, ExpiresAt 
            FROM refresh_tokens 
            WHERE Token = ? AND ExpiresAt > NOW()",
            [$tokenHash]
        );
        
        if (!$token) {
            $this->response(false, 'Invalid or expired refresh token', [], 401);
        }
        
        // Generate new access token
        $accessToken = Auth::generateToken($token['UserID']);
        
        // Generate new refresh token (token rotation for security)
        $newRefreshToken = Auth::generateRefreshToken();
        $newTokenHash = hash('sha256', $newRefreshToken);
        
        // Delete old refresh token
        Database::query(
            "DELETE FROM refresh_tokens WHERE Token = ?",
            [$tokenHash]
        );
        
        // Store new refresh token
        Database::insert('refresh_tokens', [
            'UserID' => $token['UserID'],
            'Token' => $newTokenHash,
            'ExpiresAt' => date('Y-m-d H:i:s', time() + REFRESH_TOKEN_EXPIRY),
            'CreatedAt' => date('Y-m-d H:i:s')
        ]);
        
        $this->response(true, 'Token refreshed', [
            'access_token' => $accessToken,
            'refresh_token' => $newRefreshToken, // Return new refresh token
            'token_type' => 'Bearer',
            'expires_in' => JWT_EXPIRY
        ]);
    }
    
    public function logout(): void {
        $userID = $GLOBALS['authenticated_user'] ?? null;
        
        if ($userID) {
            // Delete all refresh tokens for this user
            Database::query(
                "DELETE FROM refresh_tokens WHERE UserID = ?",
                [$userID]
            );
        }
        
        $this->response(true, 'Logged out successfully');
    }

    public function clearRateLimitCache(): void {
        $files = glob(RATE_LIMIT_CACHE_PATH . '/*.json');
        $count = 0;
        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file);
                $count++;
            }
        }
        echo "Cache Deleted: ".$count;
    }

    public function clearExpiredTokensAndLoginAttempts(): void {
        Database::query("DELETE FROM refresh_tokens WHERE ExpiresAt < NOW()");
        Database::query("DELETE FROM login_attempts WHERE AttemptedAt < DATE_SUB(NOW(), INTERVAL 30 DAY)");
        
        echo "Expired Tokens and Login Attempts cleared";
    }
}