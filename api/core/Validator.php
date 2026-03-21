<?php
// core/Validator.php
declare(strict_types=1);

namespace App\core;

class Validator {
    private array $errors = [];
    
    public function validate(array $data, array $rules): bool {
        $this->errors = [];
        
        foreach ($rules as $field => $ruleSet) {
            $rulesArray = explode('|', $ruleSet);
            $value = $data[$field] ?? null;
            
            foreach ($rulesArray as $rule) {
                $this->applyRule($field, $value, $rule, $data);
            }
        }
        
        return empty($this->errors);
    }
    
    private function applyRule(string $field, mixed $value, string $rule, array $data): void {
        if (str_starts_with($rule, 'min:')) {
            $min = (int) substr($rule, 4);
            if (strlen((string)$value) < $min) {
                $this->errors[$field][] = "{$field} must be at least {$min} characters";
            }
            return;
        }
        
        if (str_starts_with($rule, 'max:')) {
            $max = (int) substr($rule, 4);
            if (strlen((string)$value) > $max) {
                $this->errors[$field][] = "{$field} must not exceed {$max} characters";
            }
            return;
        }
        
        if (str_starts_with($rule, 'same:')) {
            $otherField = substr($rule, 5);
            if ($value !== ($data[$otherField] ?? null)) {
                $this->errors[$field][] = "{$field} must match {$otherField}";
            }
            return;
        }
        
        if (str_starts_with($rule, 'enum:')) {
            $allowedValues = explode(',', substr($rule, 5));
            if (!in_array($value, $allowedValues, true)) {
                $this->errors[$field][] = "{$field} must be one of: " . implode(', ', $allowedValues);
            }
            return;
        }
        
        switch ($rule) {
            case 'required':
                if (empty($value) && $value !== '0') {
                    $this->errors[$field][] = "{$field} is required";
                }
                break;
                
            case 'email':
                if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $this->errors[$field][] = "{$field} must be a valid email";
                }
                break;
                
            case 'numeric':
                if (!is_numeric($value)) {
                    $this->errors[$field][] = "{$field} must be numeric";
                }
                break;
                
            case 'alpha':
                if (!ctype_alpha(str_replace(' ', '', (string)$value))) {
                    $this->errors[$field][] = "{$field} must contain only letters";
                }
                break;
                
            case 'alphanumeric':
                if (!ctype_alnum(str_replace([' ', '-', '_'], '', (string)$value))) {
                    $this->errors[$field][] = "{$field} must contain only letters and numbers";
                }
                break;
                
            case 'date':
                if (!strtotime((string)$value)) {
                    $this->errors[$field][] = "{$field} must be a valid date";
                }
                break;
        }
    }
    
    public function getErrors(): array {
        return $this->errors;
    }
    
    public function getFirstError(): ?string {
        if (empty($this->errors)) {
            return null;
        }
        
        $firstField = array_key_first($this->errors);
        return $this->errors[$firstField][0] ?? null;
    }
    
    public static function sanitize(string $input): string {
        return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
    }
}