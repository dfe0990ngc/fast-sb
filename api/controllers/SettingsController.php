<?php
declare(strict_types=1);

namespace App\controllers;

use App\controllers\Controller;
use App\core\Database;
use Exception;
use Ifsnop\Mysqldump\Mysqldump;
use ZipArchive;

class SettingsController extends Controller {

    public function clearCaches(): void {
        $files = glob(RATE_LIMIT_CACHE_PATH . '/*.json');
        $count = 0;

        // Clear DB cache
        Database::query("DELETE FROM refresh_tokens WHERE ExpiresAt < NOW()");
        Database::query("DELETE FROM login_attempts WHERE AttemptedAt < DATE_SUB(NOW(), INTERVAL 30 DAY)");

        // Clear rate limit cache
        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
        
        $this->response(true, "Caches deleted successfully!");
    }

    public function clearLogs(): void {
        try {
            $logDir = LOG_PATH;
            $logFile = $logDir . '/php-error.log';

            if (file_exists($logFile)) {
                // Clear the file content
                if (file_put_contents($logFile, '') !== false) {
                    $this->response(true, "Logs cleared successfully.");
                } else {
                    throw new Exception("Unable to clear the log file. Check file permissions.");
                }
            } else {
                $this->response(true, "Log file does not exist. Nothing to clear.");
            }
        } catch (Exception $e) {
            $this->response(false, "An error occurred: " . $e->getMessage(),[],500);
        }
    }

    public function exportBackup(): void {
        $sqlFilePath = null;
        $zipFilePath = null;

        if (!class_exists('ZipArchive')) {
            $this->response(false, 'Server configuration error: The PHP "zip" extension is not enabled.', [], 501);
        }

        try {
            // Database credentials from your configuration.
            $dbHost = DB_HOST;
            $dbName = DB_NAME;
            $dbUser = DB_USER;
            $dbPass = DB_PASS;

            $storagePath = __DIR__ . '/../storage/backups';
            if (!is_dir($storagePath)) {
                mkdir($storagePath, 0755, true); // Use 0755 for better security
            }

            $timestamp = date('Y-m-d-H-i-s');
            $sqlFileName = "backup-{$timestamp}.sql";
            $zipFileName = "backup-{$timestamp}.zip";
            $sqlFilePath = "{$storagePath}/{$sqlFileName}";
            $zipFilePath = "{$storagePath}/{$zipFileName}";

            // Create a new database dump using mysqldump-php
            $dump = new Mysqldump("mysql:host={$dbHost};dbname={$dbName}", $dbUser, $dbPass, [
                'add-drop-table' => true, // Add DROP TABLE statements
            ]);
            $dump->start($sqlFilePath);

            // Create a zip archive
            $zip = new ZipArchive();
            if ($zip->open($zipFilePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
                throw new Exception("Cannot create zip archive.");
            }
            $zip->addFile($sqlFilePath, $sqlFileName);
            $zip->close();

            // Send the file for download
            header('Content-Type: application/zip');
            header('Content-Disposition: attachment; filename="' . basename($zipFileName) . '"');
            header('Content-Length: ' . filesize($zipFilePath));
            header('Pragma: no-cache');
            readfile($zipFilePath);
            
            // Clean up after successful download
            if (isset($sqlFilePath) && file_exists($sqlFilePath)) {
                unlink($sqlFilePath);
            }
            if (isset($zipFilePath) && file_exists($zipFilePath)) {
                unlink($zipFilePath);
            }

            exit;

        } catch (Exception $e) {
            // Clean up files on error before sending response
            if ($sqlFilePath && file_exists($sqlFilePath)) { unlink($sqlFilePath); }
            if ($zipFilePath && file_exists($zipFilePath)) { unlink($zipFilePath); }
            $this->response(false, "Backup failed: " . $e->getMessage(), [], 500);
        }
    }
}