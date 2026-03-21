<?php
// core/Router.php
declare(strict_types=1);

namespace App\core;

use ReflectionMethod;

class Router {
    private array $routes = [];
    private string $basePath = '';
    private array $params = [];
    
    public function setBasePath(string $basePath): void {
        $this->basePath = rtrim($basePath, '/');
    }
    
    private function addRoute(string $method, string $path, array $handler, array $middleware = []): void {
        $this->routes[] = [
            'method' => $method,
            'path' => $path,
            'handler' => $handler,
            'middleware' => $middleware
        ];
    }
    
    public function get(string $path, array $handler, array $middleware = []): void {
        $this->addRoute('GET', $path, $handler, $middleware);
    }
    
    public function post(string $path, array $handler, array $middleware = []): void {
        $this->addRoute('POST', $path, $handler, $middleware);
    }
    
    public function put(string $path, array $handler, array $middleware = []): void {
        $this->addRoute('PUT', $path, $handler, $middleware);
    }
    
    public function delete(string $path, array $handler, array $middleware = []): void {
        $this->addRoute('DELETE', $path, $handler, $middleware);
    }
    
    public function dispatch(): void {
        $method = $_SERVER['REQUEST_METHOD'];
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        
        // Remove base path from URI if it exists
        if ($this->basePath && strpos($uri, $this->basePath) === 0) {
            $uri = substr($uri, strlen($this->basePath));
            // Ensure URI starts with / after removing base path
            if (empty($uri) || $uri[0] !== '/') {
                $uri = '/' . $uri;
            }
        }
        
        foreach ($this->routes as $route) {
            if ($route['method'] === $method && $this->matchPath($route['path'], $uri)) {
                // Execute middleware
                foreach ($route['middleware'] as $middleware) {
                    $middlewareInstance = new $middleware();
                    $middlewareInstance->handle();
                }
                
                // Store params in $_GET for backward compatibility
                foreach ($this->params as $key => $value) {
                    $_GET[$key] = $value;
                }
                
                // Execute handler with route parameters as arguments
                [$controller, $action] = $route['handler'];
                $controllerInstance = new $controller();
                
                // Call method with parameters as arguments
                // Extract parameter values in the order they appear in the route
                $reflection = new ReflectionMethod($controller, $action);
                $methodParams = $reflection->getParameters();
                $args = [];
                
                foreach ($methodParams as $param) {
                    $paramName = $param->getName();
                    if (isset($this->params[$paramName])) {
                        $args[] = $this->params[$paramName];
                    } elseif ($param->isDefaultValueAvailable()) {
                        $args[] = $param->getDefaultValue();
                    } else {
                        $args[] = null;
                    }
                }
                
                call_user_func_array([$controllerInstance, $action], $args);
                return;
            }
        }
        
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Endpoint not found'
        ]);
    }
    
    private function matchPath(string $routePath, string $uri): bool {
        // Reset params
        $this->params = [];
        
        // Exact match (for routes without parameters)
        if ($routePath === $uri) {
            return true;
        }
        
        // Convert route path to regex pattern
        // Replace {param} with named regex capture groups
        $pattern = preg_replace('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', '(?P<$1>[^/]+)', $routePath);
        
        // Escape forward slashes for regex
        $pattern = '#^' . $pattern . '$#';
        
        // Match URI against pattern
        if (preg_match($pattern, $uri, $matches)) {
            // Extract named parameters
            foreach ($matches as $key => $value) {
                if (is_string($key)) {
                    $this->params[$key] = $value;
                }
            }
            return true;
        }
        
        return false;
    }
    
    /**
     * Get route parameter value
     */
    public function getParam(string $key): ?string {
        return $this->params[$key] ?? null;
    }
    
    /**
     * Get all route parameters
     */
    public function getParams(): array {
        return $this->params;
    }
}