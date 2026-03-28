<?php
declare(strict_types=1);

namespace App\services\documents;

final class PdfUploadSupport
{
    public const MAX_FILES = 7;
    public const MAX_FILE_SIZE_BYTES = 52428800; // 50 MB
    public const ALLOWED_MIME_TYPES = ['application/pdf'];

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function normalizeUploadedFiles(string $fieldName): array
    {
        if (!isset($_FILES[$fieldName])) {
            return [];
        }

        $fileData = $_FILES[$fieldName];
        if (!is_array($fileData['name'] ?? null)) {
            return [$fileData];
        }

        $normalized = [];
        $count = count($fileData['name']);
        for ($index = 0; $index < $count; $index++) {
            $normalized[] = [
                'name' => $fileData['name'][$index] ?? '',
                'type' => $fileData['type'][$index] ?? '',
                'tmp_name' => $fileData['tmp_name'][$index] ?? '',
                'error' => $fileData['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                'size' => $fileData['size'][$index] ?? 0,
            ];
        }

        return array_values(array_filter($normalized, static function (array $file): bool {
            return (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        }));
    }

    /**
     * Validates a single PDF upload.
     */
    public static function validatePdfUpload(array $file, string $context = 'document'): ?string
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return 'One of the selected files failed to upload.';
        }

        $fileName = (string)($file['name'] ?? '');
        $extension = strtolower((string)pathinfo($fileName, PATHINFO_EXTENSION));
        if ($extension !== 'pdf') {
            return 'Only PDF files are allowed for ' . $context . '.';
        }

        $fileSize = (int)($file['size'] ?? 0);
        if ($fileSize <= 0) {
            return 'One of the selected files is empty.';
        }

        if ($fileSize > self::MAX_FILE_SIZE_BYTES) {
            return 'Each PDF file must be 50 MB or smaller.';
        }

        $tmpName = (string)($file['tmp_name'] ?? '');
        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            return 'Invalid uploaded PDF file.';
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = $finfo ? (string)finfo_file($finfo, $tmpName) : '';
        if ($finfo) {
            finfo_close($finfo);
        }

        if (!in_array($mimeType, self::ALLOWED_MIME_TYPES, true)) {
            return 'Only scanned PDF files are allowed.';
        }

        return null;
    }

    public static function validateBatch(array $files, int $existingCount, string $entityLabel, string $documentLabel): ?string
    {
        if (empty($files)) {
            return 'Please attach at least one PDF file.';
        }

        if (count($files) > self::MAX_FILES) {
            return 'You can upload a maximum of ' . self::MAX_FILES . ' PDF files at once.';
        }

        if (($existingCount + count($files)) > self::MAX_FILES) {
            $remainingSlots = max(self::MAX_FILES - $existingCount, 0);
            return 'This ' . $entityLabel . ' can only have up to ' . self::MAX_FILES . ' ' . $documentLabel . '. Remaining slots: ' . $remainingSlots . '.';
        }

        return null;
    }
}
