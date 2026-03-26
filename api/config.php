<?php

use Dotenv\Dotenv;

// Look for the .env file in the 'api' directory first, then in the project root.
// This makes the configuration more flexible.
$dotenv = Dotenv::createImmutable([__DIR__, __DIR__ . '/..']);
$dotenv->load();

// Define constants from .env variables for easy access
define('DEBUG_MODE', ($_ENV['APP_DEBUG'] ?? 'false') === 'true');

// Database
define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_NAME', $_ENV['DB_NAME'] ?? '');
define('DB_USER', $_ENV['DB_USER'] ?? 'root');
define('DB_PASS', $_ENV['DB_PASS'] ?? '');
define('DB_CHARSET', $_ENV['DB_CHARSET'] ?? 'utf8mb4');

// JWT
define('JWT_SECRET', $_ENV['JWT_SECRET'] ?? 'your-super-secret-key');
define('JWT_EXPIRY', (int) ($_ENV['JWT_EXPIRY'] ?? 3600)); // 1 hour in seconds
define('JWT_ALGORITHM', $_ENV['JWT_ALGORITHM'] ?? 'HS256');

define('REFRESH_TOKEN_EXPIRY', (int) ($_ENV['REFRESH_TOKEN_EXPIRY'] ?? 604800)); // 7 days

// Rate Limiting
define('RATE_LIMIT_REQUESTS', (int) ($_ENV['RATE_LIMIT_REQUESTS'] ?? 100));
define('RATE_LIMIT_WINDOW', (int) ($_ENV['RATE_LIMIT_WINDOW'] ?? 3600));
define('LOGIN_RATE_LIMIT', (int) ($_ENV['LOGIN_RATE_LIMIT'] ?? 5));
define('LOGIN_RATE_WINDOW', (int) ($_ENV['LOGIN_RATE_WINDOW'] ?? 900)); // 15 minutes

// Application Paths
define('RATE_LIMIT_CACHE_PATH', __DIR__ . '/storage/cache/ratelimit');
define('LOG_PATH', __DIR__ . '/storage/logs');

define('R2_ENDPOINT', $_ENV['R2_ENDPOINT'] ?: '');
define('R2_ACCESS_KEY', $_ENV['R2_ACCESS_KEY'] ?: '');
define('R2_SECRET_KEY', $_ENV['R2_SECRET_KEY'] ?: '');
define('R2_BUCKET', $_ENV['R2_BUCKET'] ?: '');
define('R2_PUBLIC_URL', $_ENV['R2_PUBLIC_URL'] ?: '');

define('STORAGE_DRIVER',$_ENV['STORAGE_DRIVER'] ?: 'local');


?>