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

    protected function numberToWords($number) {
        $hyphen      = '-';
        $conjunction = ' and ';
        $separator   = ', ';
        $negative    = 'negative ';
        $decimal     = ' point ';

        $dictionary  = [
            0                   => 'zero',
            1                   => 'one',
            2                   => 'two',
            3                   => 'three',
            4                   => 'four',
            5                   => 'five',
            6                   => 'six',
            7                   => 'seven',
            8                   => 'eight',
            9                   => 'nine',
            10                  => 'ten',
            11                  => 'eleven',
            12                  => 'twelve',
            13                  => 'thirteen',
            14                  => 'fourteen',
            15                  => 'fifteen',
            16                  => 'sixteen',
            17                  => 'seventeen',
            18                  => 'eighteen',
            19                  => 'nineteen',
            20                  => 'twenty',
            30                  => 'thirty',
            40                  => 'forty',
            50                  => 'fifty',
            60                  => 'sixty',
            70                  => 'seventy',
            80                  => 'eighty',
            90                  => 'ninety',
            100                 => 'hundred',
            1000                => 'thousand',
            1000000             => 'million',
            1000000000          => 'billion',
        ];

        if (!is_numeric($number)) {
            return false;
        }

        if ($number < 0) {
            return $negative . $this->numberToWords(abs($number));
        }

        $string = $fraction = null;

        if (strpos((string)$number, '.') !== false) {
            list($number, $fraction) = explode('.', (string)$number);
        }

        switch (true) {
            case $number < 21:
                $string = $dictionary[$number];
                break;

            case $number < 100:
                $tens   = ((int) ($number / 10)) * 10;
                $units  = $number % 10;
                $string = $dictionary[$tens];
                if ($units) {
                    $string .= $hyphen . $dictionary[$units];
                }
                break;

            case $number < 1000:
                $hundreds  = (int) ($number / 100);
                $remainder = $number % 100;

                $string = $dictionary[$hundreds] . ' ' . $dictionary[100];
                if ($remainder) {
                    $string .= $conjunction . $this->numberToWords($remainder);
                }
                break;

            default:
                $baseUnit = pow(1000, floor(log($number, 1000)));
                $numBaseUnits = (int) ($number / $baseUnit);
                $remainder = $number % $baseUnit;

                $string = $this->numberToWords($numBaseUnits) . ' ' . $dictionary[$baseUnit];

                if ($remainder) {
                    $string .= $remainder < 100 ? $conjunction : $separator;
                    $string .= $this->numberToWords($remainder);
                }
                break;
        }

        if (null !== $fraction && is_numeric($fraction)) {
            $string .= $decimal;
            $words = [];
            foreach (str_split($fraction) as $digit) {
                $words[] = $dictionary[$digit];
            }
            $string .= implode(' ', $words);
        }

        return $string;
    }
}