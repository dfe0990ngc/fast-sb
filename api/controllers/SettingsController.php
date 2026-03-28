<?php

declare(strict_types=1);

namespace App\controllers;

use App\controllers\Controller;
use App\core\Database;
use Exception;
use Ifsnop\Mysqldump\Mysqldump;
use mysqli;
use ZipArchive;

class SettingsController extends Controller
{
    public function clearCaches(): void
    {
        $files = glob(RATE_LIMIT_CACHE_PATH . '/*.json');

        Database::query("DELETE FROM refresh_tokens WHERE ExpiresAt < NOW()");
        Database::query("DELETE FROM login_attempts WHERE AttemptedAt < DATE_SUB(NOW(), INTERVAL 30 DAY)");

        foreach ($files as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }

        $this->response(true, 'Caches deleted successfully!');
    }

    public function clearLogs(): void
    {
        try {
            $logDir = LOG_PATH;
            $logFile = $logDir . '/php-error.log';

            if (file_exists($logFile)) {
                if (file_put_contents($logFile, '') !== false) {
                    $this->response(true, 'Logs cleared successfully.');
                } else {
                    throw new Exception('Unable to clear the log file. Check file permissions.');
                }
            } else {
                $this->response(true, 'Log file does not exist. Nothing to clear.');
            }
        } catch (Exception $e) {
            $this->response(false, 'An error occurred: ' . $e->getMessage(), [], 500);
        }
    }

    public function exportBackup(): void
    {
        $sqlFilePath = null;
        $zipFilePath = null;

        if (!class_exists('ZipArchive')) {
            $this->response(false, 'Server configuration error: The PHP "zip" extension is not enabled.', [], 501);
        }

        try {
            $storagePath = $this->getBackupStoragePath();
            $timestamp = date('Y-m-d-H-i-s');
            $sqlFileName = "backup-{$timestamp}.sql";
            $zipFileName = "backup-{$timestamp}.zip";
            $sqlFilePath = "{$storagePath}/{$sqlFileName}";
            $zipFilePath = "{$storagePath}/{$zipFileName}";

            $this->createDatabaseDump($sqlFilePath);
            $this->zipSqlBackup($sqlFilePath, $zipFilePath, $sqlFileName);

            header('Content-Type: application/zip');
            header('Content-Disposition: attachment; filename="' . basename($zipFileName) . '"');
            header('Content-Length: ' . filesize($zipFilePath));
            header('Pragma: no-cache');
            readfile($zipFilePath);

            if ($sqlFilePath && file_exists($sqlFilePath)) {
                unlink($sqlFilePath);
            }
            if ($zipFilePath && file_exists($zipFilePath)) {
                unlink($zipFilePath);
            }

            exit;
        } catch (Exception $e) {
            if ($sqlFilePath && file_exists($sqlFilePath)) {
                unlink($sqlFilePath);
            }
            if ($zipFilePath && file_exists($zipFilePath)) {
                unlink($zipFilePath);
            }
            $this->response(false, 'Backup failed: ' . $e->getMessage(), [], 500);
        }
    }

    public function restoreBackup(): void
    {
        $tempDir = null;
        $sqlFilePath = null;
        $safetyBackup = null;

        if (!class_exists('ZipArchive')) {
            $this->response(false, 'Server configuration error: The PHP "zip" extension is not enabled.', [], 501);
        }

        try {
            @ini_set('memory_limit', '512M');
            @set_time_limit(0);

            if (!isset($_FILES['backup']) || !is_array($_FILES['backup'])) {
                throw new Exception('Please select a backup file to restore.');
            }

            $file = $_FILES['backup'];
            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                throw new Exception($this->getUploadErrorMessage((int) ($file['error'] ?? UPLOAD_ERR_NO_FILE)));
            }

            $originalName = (string) ($file['name'] ?? '');
            $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            if (!in_array($extension, ['sql', 'zip'], true)) {
                throw new Exception('Invalid backup file. Please upload a .sql or .zip backup.');
            }

            $tempDir = sys_get_temp_dir() . '/fastsb-restore-' . bin2hex(random_bytes(8));
            if (!mkdir($tempDir, 0700, true) && !is_dir($tempDir)) {
                throw new Exception('Unable to create temporary restore directory.');
            }

            if ($extension === 'zip') {
                $sqlFilePath = $this->extractSqlFromZip((string) $file['tmp_name'], $tempDir);
            } else {
                $sqlFilePath = $tempDir . '/' . basename($originalName ?: 'backup.sql');
                if (!move_uploaded_file((string) $file['tmp_name'], $sqlFilePath)) {
                    throw new Exception('Unable to move the uploaded SQL file for restore.');
                }
            }

            if (!is_file($sqlFilePath) || filesize($sqlFilePath) === 0) {
                throw new Exception('The backup SQL file is empty or could not be prepared for restore.');
            }

            $safetyBackup = $this->createSafetyBackup();
            $this->importSqlFile($sqlFilePath);

            $this->response(true, 'Database restored successfully.', [
                'safety_backup' => $safetyBackup['file_name'] ?? null,
                'note' => 'A safety backup of the previous database state was created before restore.',
            ]);
        } catch (Exception $e) {
            $this->response(false, 'Restore failed: ' . $e->getMessage(), [
                'safety_backup' => $safetyBackup['file_name'] ?? null,
                'note' => 'Automatic rollback is not guaranteed for full SQL restores because DDL statements like DROP TABLE and CREATE TABLE are not reliably reversible as one transaction.',
            ], 500);
        } finally {
            if ($tempDir && is_dir($tempDir)) {
                $this->deleteDirectory($tempDir);
            }
        }
    }

    private function getBackupStoragePath(): string
    {
        $storagePath = __DIR__ . '/../storage/backups';
        if (!is_dir($storagePath) && !mkdir($storagePath, 0755, true) && !is_dir($storagePath)) {
            throw new Exception('Unable to create backups storage directory.');
        }

        return $storagePath;
    }

    private function createDatabaseDump(string $sqlFilePath): void
    {
        $dump = new Mysqldump(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME,
            DB_USER,
            DB_PASS,
            [
                'add-drop-table' => true,
                'default-character-set' => 'utf8mb4',
            ]
        );

        $dump->start($sqlFilePath);
    }

    private function zipSqlBackup(string $sqlFilePath, string $zipFilePath, string $sqlFileName): void
    {
        $zip = new ZipArchive();
        if ($zip->open($zipFilePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new Exception('Cannot create zip archive.');
        }

        $zip->addFile($sqlFilePath, $sqlFileName);
        $zip->close();
    }

    private function createSafetyBackup(): array
    {
        $storagePath = $this->getBackupStoragePath();
        $timestamp = date('Y-m-d-H-i-s');
        $sqlFileName = "pre-restore-safety-{$timestamp}.sql";
        $zipFileName = "pre-restore-safety-{$timestamp}.zip";
        $sqlFilePath = "{$storagePath}/{$sqlFileName}";
        $zipFilePath = "{$storagePath}/{$zipFileName}";

        $this->createDatabaseDump($sqlFilePath);
        $this->zipSqlBackup($sqlFilePath, $zipFilePath, $sqlFileName);

        if (file_exists($sqlFilePath)) {
            unlink($sqlFilePath);
        }

        return [
            'file_path' => $zipFilePath,
            'file_name' => basename($zipFilePath),
        ];
    }

    private function extractSqlFromZip(string $zipTmpPath, string $destinationDir): string
    {
        $zip = new ZipArchive();
        if ($zip->open($zipTmpPath) !== true) {
            throw new Exception('Unable to open the uploaded ZIP backup.');
        }

        $sqlEntryName = null;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $entryName = $zip->getNameIndex($i);
            if (!$entryName || str_ends_with($entryName, '/')) {
                continue;
            }

            if (strtolower(pathinfo($entryName, PATHINFO_EXTENSION)) === 'sql') {
                $sqlEntryName = $entryName;
                break;
            }
        }

        if (!$sqlEntryName) {
            $zip->close();
            throw new Exception('The ZIP backup does not contain any .sql file.');
        }

        if (!$zip->extractTo($destinationDir, [$sqlEntryName])) {
            $zip->close();
            throw new Exception('Unable to extract the SQL file from the ZIP backup.');
        }

        $zip->close();

        $sqlPath = $destinationDir . '/' . $sqlEntryName;
        if (!is_file($sqlPath)) {
            throw new Exception('The extracted SQL file could not be found.');
        }

        return $sqlPath;
    }

    private function importSqlFile(string $sqlFilePath): void
    {
        $sql = file_get_contents($sqlFilePath);
        if ($sql === false || trim($sql) === '') {
            throw new Exception('Unable to read SQL backup contents.');
        }

        $port = defined('DB_PORT') ? (int) DB_PORT : 3306;
        $mysqli = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, $port);

        if ($mysqli->connect_error) {
            throw new Exception('Database connection failed: ' . $mysqli->connect_error);
        }

        $mysqli->set_charset('utf8mb4');

        try {
            if (!$mysqli->multi_query($sql)) {
                throw new Exception($mysqli->error ?: 'Unknown SQL execution error.');
            }

            do {
                if ($result = $mysqli->store_result()) {
                    $result->free();
                }

                if ($mysqli->errno) {
                    throw new Exception($mysqli->error);
                }
            } while ($mysqli->more_results() && $mysqli->next_result());

            if ($mysqli->errno) {
                throw new Exception($mysqli->error);
            }
        } finally {
            $mysqli->close();
        }
    }

    private function getUploadErrorMessage(int $errorCode): string
    {
        return match ($errorCode) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'The uploaded backup file is too large.',
            UPLOAD_ERR_PARTIAL => 'The backup file was only partially uploaded. Please try again.',
            UPLOAD_ERR_NO_FILE => 'Please select a backup file to restore.',
            UPLOAD_ERR_NO_TMP_DIR => 'Server configuration error: missing temporary upload directory.',
            UPLOAD_ERR_CANT_WRITE => 'Server error: failed to write the uploaded backup file.',
            UPLOAD_ERR_EXTENSION => 'Server blocked the uploaded backup file.',
            default => 'Unknown upload error while receiving the backup file.',
        };
    }

    private function deleteDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }

        $items = scandir($directory);
        if ($items === false) {
            return;
        }

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $path = $directory . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                $this->deleteDirectory($path);
            } elseif (file_exists($path)) {
                unlink($path);
            }
        }

        @rmdir($directory);
    }
}
