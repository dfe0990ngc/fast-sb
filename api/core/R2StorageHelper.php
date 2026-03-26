<?php
declare(strict_types=1);

namespace App\core;

use Aws\S3\S3Client;
use Aws\Exception\AwsException;
use Exception;

class R2StorageHelper
{
    private static ?S3Client $client = null;
    private static string $bucket    = '';

    private static function isLocal(): bool
    {
        return defined('STORAGE_DRIVER') && STORAGE_DRIVER == 'local';
    }

    private static function localBase(): string
    {
        return dirname(__DIR__,1) . '/storage/r2_files/';
    }

    private static function localPath(string $key): string
    {
        return rtrim(self::localBase(), '/') . '/' . ltrim($key, '/');
    }

    private static function client(): S3Client
    {
        if (self::$client !== null) {
            return self::$client;
        }

        $endpoint  = R2_ENDPOINT;
        $accessKey = R2_ACCESS_KEY;
        $secretKey = R2_SECRET_KEY;
        self::$bucket = R2_BUCKET ?? '';

        if (!$endpoint || !$accessKey || !$secretKey || !self::$bucket) {
            throw new Exception(
                'R2 configuration is incomplete. ' .
                'Please set R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, and R2_BUCKET in your .env file.'
            );
        }

        self::$client = new S3Client([
            'version'                 => 'latest',
            'region'                  => 'auto',
            'endpoint'                => $endpoint,
            'credentials'             => [
                'key'    => $accessKey,
                'secret' => $secretKey,
            ],
            'use_path_style_endpoint' => true,
        ]);

        return self::$client;
    }

    public static function upload(
        string $localPath,
        string $r2Key,
        string $contentType = 'application/pdf',
        string $acl = 'private'
    ): array {

        if (self::isLocal()) {

            $dest = self::localPath($r2Key);

            $dir = dirname($dest);
            if (!is_dir($dir)) {
                mkdir($dir, 0777, true);
            }

            if (!copy($localPath, $dest)) {
                return [
                    'success' => false,
                    'key' => $r2Key,
                    'file_path' => $r2Key,
                    'url' => null,
                    'message' => 'Local upload failed'
                ];
            }

            return [
                'success' => true,
                'key' => $r2Key,
                'file_path' => $r2Key,
                'url' => null,
                'message' => 'Stored locally'
            ];
        }

        /* ORIGINAL R2 LOGIC */
        try {
            $client = self::client();

            $client->putObject([
                'Bucket'      => self::$bucket,
                'Key'         => $r2Key,
                'SourceFile'  => $localPath,
                'ContentType' => $contentType,
                'ACL'         => $acl,
            ]);

            $publicBase = R2_PUBLIC_URL;
            $url = $publicBase
                ? rtrim($publicBase, '/') . '/' . ltrim($r2Key, '/')
                : null;

            return [
                'success'   => true,
                'key'       => $r2Key,
                'file_path' => $r2Key,
                'url'       => $url,
                'message'   => 'File uploaded successfully',
            ];

        } catch (AwsException $e) {
            error_log('R2 upload error: ' . $e->getMessage());

            return [
                'success'   => false,
                'key'       => $r2Key,
                'file_path' => $r2Key,
                'url'       => null,
                'message'   => 'Upload failed',
            ];
        }
    }

    /**
     * Send a temporary redirect to a presigned R2 URL.
     * Replaces streamToBrowser() for most use-cases.
     *
     * @param int $ttl  Seconds the URL is valid (default 5 min)
     */
        public static function redirectToPresigned(
        string $r2Key,
        int    $ttl = 300
    ): never {

        // PRIORITIZE LOCAL STORAGE
        if (self::isLocal()) {

            $path = self::localPath($r2Key);

            if (!file_exists($path)) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'File not found']);
                exit;
            }

            // Detect mime automatically
            $mime = mime_content_type($path) ?: 'application/octet-stream';
            $fileName = basename($path);

            header('Content-Type: ' . $mime);
            header('Content-Disposition: inline; filename="' . $fileName . '"');
            header('Content-Length: ' . filesize($path));
            header('Cache-Control: no-store');

            readfile($path);
            exit;
        }

        // ORIGINAL R2 BEHAVIOR
        $url = self::presignedUrl($r2Key, $ttl);

        if (!$url) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'File not found']);
            exit;
        }

        header('Cache-Control: no-store, no-cache, must-revalidate');
        header('Pragma: no-cache');
        header('Location: ' . $url, true, 302);
        exit;
    }

    public static function uploadContent(
        string $content,
        string $r2Key,
        string $contentType = 'application/pdf',
        string $acl = 'private'
    ): array {
        try {
            $client = self::client();

            $client->putObject([
                'Bucket'      => self::$bucket,
                'Key'         => $r2Key,
                'Body'        => $content,
                'ContentType' => $contentType,
                'ACL'         => $acl,
            ]);

            $publicBase = R2_PUBLIC_URL;
            $url = $publicBase
                ? rtrim($publicBase, '/') . '/' . ltrim($r2Key, '/')
                : null;

            return [
                'success'   => true,
                'key'       => $r2Key,
                'file_path' => $r2Key,   // ← alias
                'url'       => $url,
                'message'   => 'Content uploaded successfully',
            ];

        } catch (AwsException $e) {
            error_log('R2 uploadContent error: ' . $e->getMessage());
            return [
                'success'   => false,
                'key'       => $r2Key,
                'file_path' => $r2Key,
                'url'       => null,
                'message'   => 'Upload failed: ' . $e->getAwsErrorMessage(),
            ];
        }
    }

    /**
     * Upload a PHP $_FILES entry directly to R2.
     *
     * Returns 'file_path' AND 'key' — both point to the R2 object key.
     * Controllers can use either without breaking.
     */
    public static function uploadFromRequest(
        array  $fileEntry,
        string $folder      = 'documents',
        array  $allowedMime = ['application/pdf'],
        int    $maxBytes    = 10485760
    ): array {
        if ($fileEntry['error'] !== UPLOAD_ERR_OK) {
            $errors = [
                UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
                UPLOAD_ERR_FORM_SIZE  => 'File exceeds form upload limit',
                UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
                UPLOAD_ERR_NO_FILE    => 'No file was uploaded',
                UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
                UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
                UPLOAD_ERR_EXTENSION  => 'Upload stopped by PHP extension',
            ];
            return [
                'success'   => false,
                'key'       => '',
                'file_path' => '',   // ← alias
                'file_size' => 0,
                'url'       => null,
                'message'   => $errors[$fileEntry['error']] ?? 'Unknown upload error',
            ];
        }

        if ($fileEntry['size'] > $maxBytes) {
            $mb = round($maxBytes / 1048576);
            return [
                'success'   => false,
                'key'       => '',
                'file_path' => '',   // ← alias
                'file_size' => 0,
                'url'       => null,
                'message'   => "File size exceeds the maximum allowed size ({$mb}MB)",
            ];
        }

        $finfo    = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $fileEntry['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, $allowedMime, true)) {
            $allowed = implode(', ', $allowedMime);
            return [
                'success'   => false,
                'key'       => '',
                'file_path' => '',   // ← alias
                'file_size' => 0,
                'url'       => null,
                'message'   => "Invalid file type ({$mimeType}). Allowed: {$allowed}",
            ];
        }

        $ext   = strtolower(pathinfo($fileEntry['name'], PATHINFO_EXTENSION));
        $r2Key = trim($folder, '/') . '/' . uniqid('doc_', true) . '_' . time() . '.' . $ext;

        $result = self::upload($fileEntry['tmp_name'], $r2Key, $mimeType);

        // array_merge inherits 'key' and 'file_path' from upload() — both already set
        return array_merge($result, ['file_size' => $fileEntry['size']]);
    }

    public static function streamToBrowser(
        string $r2Key,
        string $fileName,
        string $contentType = 'application/pdf',
        bool $inline = true
    ): void {

        if (self::isLocal()) {

            $path = self::localPath($r2Key);

            if (!file_exists($path)) {
                http_response_code(404);
                echo json_encode(['success'=>false,'message'=>'File not found']);
                exit;
            }

            $disposition = $inline ? 'inline' : 'attachment';

            header("Content-Type: $contentType");
            header("Content-Disposition: $disposition; filename=\"$fileName\"");
            header("Content-Length: " . filesize($path));
            header('Cache-Control: no-store');

            readfile($path);
            exit;
        }

        /* ORIGINAL R2 STREAM */
        try {
            $client = self::client();

            $result = $client->getObject([
                'Bucket' => self::$bucket,
                'Key'    => $r2Key,
            ]);

            $disposition = $inline ? 'inline' : 'attachment';

            header("Content-Type: $contentType");
            header("Content-Disposition: $disposition; filename=\"$fileName\"");
            header("Content-Length: " . $result['ContentLength']);

            $body = $result['Body'];

            while (!$body->eof()) {
                echo $body->read(65536);
                flush();
            }

        } catch (AwsException $e) {
            http_response_code(404);
            echo json_encode(['success'=>false,'message'=>'File not found']);
        }

        exit;
    }

    public static function presignedUrl(string $r2Key, int $seconds = 300): ?string
    {
        try {
            $client = self::client();
            $cmd    = $client->getCommand('GetObject', [
                'Bucket' => self::$bucket,
                'Key'    => $r2Key,
            ]);
            return (string) $client
                ->createPresignedRequest($cmd, "+{$seconds} seconds")
                ->getUri();
        } catch (AwsException $e) {
            error_log('R2 presignedUrl error: ' . $e->getMessage());
            return null;
        }
    }
    
    public static function delete(string $r2Key): bool
    {
        if (self::isLocal()) {

            $path = self::localPath($r2Key);

            if (file_exists($path)) {
                unlink($path);
            }

            return true;
        }

        try {
            self::client()->deleteObject([
                'Bucket' => self::$bucket,
                'Key'    => $r2Key,
            ]);

            return true;

        } catch (AwsException $e) {
            return false;
        }
    }

    public static function deleteBatch(array $r2Keys): bool
    {
        if (empty($r2Keys)) return true;
        $objects = array_map(fn($key) => ['Key' => $key], $r2Keys);
        try {
            self::client()->deleteObjects([
                'Bucket' => self::$bucket,
                'Delete' => ['Objects' => $objects],
            ]);
            return true;
        } catch (AwsException $e) {
            error_log('R2 deleteBatch error: ' . $e->getMessage());
            return false;
        }
    }
    
    public static function exists(string $r2Key): bool
    {
        if (self::isLocal()) {
            return file_exists(self::localPath($r2Key));
        }

        try {
            self::client()->headObject([
                'Bucket' => self::$bucket,
                'Key'    => $r2Key,
            ]);
            return true;
        } catch (AwsException $e) {
            return false;
        }
    }

    public static function list(string $prefix = '', int $maxKeys = 1000): array
    {
        try {
            $result  = self::client()->listObjectsV2([
                'Bucket'  => self::$bucket,
                'Prefix'  => $prefix,
                'MaxKeys' => $maxKeys,
            ]);
            $objects = [];
            foreach ($result['Contents'] ?? [] as $obj) {
                $objects[] = [
                    'key'           => $obj['Key'],
                    'size'          => $obj['Size'],
                    'last_modified' => (string) $obj['LastModified'],
                ];
            }
            return $objects;
        } catch (AwsException $e) {
            error_log('R2 list error: ' . $e->getMessage());
            return [];
        }
    }

    public static function copy(string $sourceKey, string $destKey): bool
    {
        try {
            self::client()->copyObject([
                'Bucket'     => self::$bucket,
                'CopySource' => self::$bucket . '/' . ltrim($sourceKey, '/'),
                'Key'        => $destKey,
            ]);
            return true;
        } catch (AwsException $e) {
            error_log('R2 copy error: ' . $e->getMessage());
            return false;
        }
    }

    public static function publicUrl(string $r2Key): ?string
    {
        $base = R2_PUBLIC_URL;
        if (!$base) return null;
        return rtrim($base, '/') . '/' . ltrim($r2Key, '/');
    }

    public static function metadata(string $r2Key): ?array
    {
        try {
            $result = self::client()->headObject([
                'Bucket' => self::$bucket,
                'Key'    => $r2Key,
            ]);
            return [
                'content_type'   => $result['ContentType']   ?? null,
                'content_length' => $result['ContentLength'] ?? null,
                'last_modified'  => (string)($result['LastModified'] ?? ''),
            ];
        } catch (AwsException $e) {
            return null;
        }
    }
}