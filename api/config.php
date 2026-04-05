<?php

use Dotenv\Dotenv;

// Load .env from api directory first, then fallback to parent
$dotenv = Dotenv::createImmutable([__DIR__, __DIR__ . '/..']);
$dotenv->safeLoad();

// App
define('DEBUG_MODE', ($_ENV['APP_DEBUG'] ?? 'false') === 'true');

// Database
define('DB_HOST', $_ENV['DB_HOST'] ?? 'fastsb_db');
define('DB_PORT', (int) ($_ENV['DB_PORT'] ?? 3306));
define('DB_NAME', $_ENV['DB_NAME'] ?? '');
define('DB_USER', $_ENV['DB_USER'] ?? 'root');
define('DB_PASS', $_ENV['DB_PASSWORD'] ?? '');
define('DB_CHARSET', $_ENV['DB_CHARSET'] ?? 'utf8mb4');

// JWT
define('JWT_SECRET', $_ENV['JWT_SECRET'] ?? 'your-super-secret-key');
define('JWT_EXPIRY', (int) ($_ENV['JWT_EXPIRY'] ?? 3600));
define('JWT_ALGORITHM', $_ENV['JWT_ALGORITHM'] ?? 'HS256');
define('REFRESH_TOKEN_EXPIRY', (int) ($_ENV['REFRESH_TOKEN_EXPIRY'] ?? 604800));

// Rate Limiting
define('RATE_LIMIT_REQUESTS', (int) ($_ENV['RATE_LIMIT_REQUESTS'] ?? 100));
define('RATE_LIMIT_WINDOW', (int) ($_ENV['RATE_LIMIT_WINDOW'] ?? 3600));
define('LOGIN_RATE_LIMIT', (int) ($_ENV['LOGIN_RATE_LIMIT'] ?? 5));
define('LOGIN_RATE_WINDOW', (int) ($_ENV['LOGIN_RATE_WINDOW'] ?? 900));

// Application Paths
define('RATE_LIMIT_CACHE_PATH', __DIR__ . '/storage/cache/ratelimit');
define('LOG_PATH', __DIR__ . '/storage/logs');

// R2 / Storage
define('R2_ENDPOINT', $_ENV['R2_ENDPOINT'] ?? '');
define('R2_ACCESS_KEY', $_ENV['R2_ACCESS_KEY'] ?? '');
define('R2_SECRET_KEY', $_ENV['R2_SECRET_KEY'] ?? '');
define('R2_BUCKET', $_ENV['R2_BUCKET'] ?? '');
define('R2_PUBLIC_URL', $_ENV['R2_PUBLIC_URL'] ?? '');

define('STORAGE_DRIVER', $_ENV['STORAGE_DRIVER'] ?? 'local');