/* eslint-disable no-unused-vars */
import axios from "axios";

// ==================================================
// Token Management
// ==================================================
let isRefreshing = false;
let failedQueue = [];
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin+'/fast-sb';

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

const setTokens = (accessToken, refreshToken, expiresIn) => {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);

  // Calculate and store expiry timestamp
  const expiryTime = Date.now() + (expiresIn * 1000);
  localStorage.setItem('token_expiry', expiryTime.toString());
};

const getAccessToken = () => {
  return localStorage.getItem('access_token');
};

const getRefreshToken = () => {
  return localStorage.getItem('refresh_token');
};

const clearTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('token_expiry');
  localStorage.removeItem('token'); // Legacy token
};

const isTokenExpired = () => {
  const expiryTime = localStorage.getItem('token_expiry');
  if (!expiryTime) return true;

  // Check if token will expire in the next 5 minutes (300000ms)
  return Date.now() >= (parseInt(expiryTime) - 300000);
};

// ==================================================
// Request Tracking for Cancellation
// ==================================================
const pendingRequests = new Map();

// ==================================================
// Axios Instance with AbortController Support
// ==================================================
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  timeout: 30000,
});

// ==================================================
// Request Interceptor to Add Auth Token & Handle Refresh
// ==================================================
api.interceptors.request.use(
  async (config) => {
    // Check if the request explicitly wants to exclude the Authorization header
    // The `excludeAuth` flag will be passed via the `config.meta` object
    if (config.meta?.excludeAuth) {
      return config; // Skip token logic entirely
    }

    // Skip token refresh for auth endpoints that don't need an existing token
    const isAuthEndpoint = config.url?.includes('/login') ||
                          config.url?.includes('/register') ||
                          config.url?.includes('/forgot-password');

    // The refresh-token endpoint itself should NOT include an access token
    // It should ONLY use the refresh token in its body.
    const isRefreshTokenEndpoint = config.url?.includes('/refresh-token');

    if (isAuthEndpoint || isRefreshTokenEndpoint) {
      return config;
    }

    let token = getAccessToken();

    // Check if token is expired or about to expire
    if (token && isTokenExpired()) {
      const refreshToken = getRefreshToken();

      if (refreshToken) {
        if (!isRefreshing) {
          isRefreshing = true;

          try {
            // Note: refresh-token request should NOT have an Authorization header
            const response = await axios.post(
              `${BASE_URL}/api/auth/refresh`, // Corrected to use /api/auth/refresh
              { refresh_token: refreshToken },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest'
                }
              }
            );

            const { access_token, refresh_token, expires_in } = response.data;
            setTokens(access_token, refresh_token, expires_in);


            token = access_token;
            isRefreshing = false;
            processQueue(null, token);
          } catch (error) {
            isRefreshing = false;
            processQueue(error, null);
            clearTokens();

            // Redirect to login or dispatch logout event
            window.dispatchEvent(new CustomEvent('auth:logout', { detail: 'token_refresh_failed' }));

            return Promise.reject(error);
          }
        } else {
          // Wait for the token refresh to complete
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(token => {
              config.headers.Authorization = `Bearer ${token}`;
              return config;
            })
            .catch(err => {
              return Promise.reject(err);
            });
        }
      } else {
        // No refresh token available
        clearTokens();
        window.dispatchEvent(new CustomEvent('auth:logout', { detail: 'no_refresh_token' }));
        // Reject the original request since there's no way to authenticate
        return Promise.reject(new Error('No refresh token available. User logged out.'));
      }
    }

    // Only add Authorization header if a token exists and it's not explicitly excluded
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ==================================================
// Response Interceptor to Handle 401 Errors
// ==================================================
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not retry if the request explicitly excluded auth or if it was the refresh token call itself
    if (originalRequest?.meta?.excludeAuth || originalRequest?.url?.includes('/refresh-token')) {
        return Promise.reject(error);
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = getRefreshToken();

      if (refreshToken && !isRefreshing) {
        isRefreshing = true;

        try {
          const response = await axios.post(
            `${BASE_URL}/api/auth/refresh`, // Corrected to use /api/auth/refresh
            { refresh_token: refreshToken },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              }
            }
          );

          const { access_token, refresh_token, expires_in } = response.data; // Destructure data
          const newAccessToken = access_token;
          const newRefreshToken = refresh_token || refreshToken; // Use new token if provided, fallback to current
          // const expiresIn = expires_in; // Already destructured
          setTokens(newAccessToken, newRefreshToken, expires_in);

          isRefreshing = false;
          processQueue(null, newAccessToken); // Use newAccessToken here

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`; // Use newAccessToken here
          return api(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          processQueue(refreshError, null);
          clearTokens();

          window.dispatchEvent(new CustomEvent('auth:logout', { detail: 'token_refresh_failed' }));

          return Promise.reject(refreshError);
        }
      } else if (isRefreshing) {
        // Wait for refresh to complete
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      } else {
        clearTokens();
        window.dispatchEvent(new CustomEvent('auth:logout', { detail: 'unauthorized' }));
        // Reject the original request since there's no way to authenticate
        return Promise.reject(new Error('Unauthorized. User logged out.'));
      }
    }

    return Promise.reject(error);
  }
);

// ==================================================
// AbortController Utilities
// ==================================================

export const createAbortController = () => {
  const controller = new AbortController();
  return {
    controller,
    signal: controller.signal
  };
};

const generateRequestKey = (method, url, data = null) => {
  const dataStr = data ? JSON.stringify(data) : '';
  return `${method.toUpperCase()}_${url}_${dataStr}`;
};

const addPendingRequest = (key, controller, options = {}) => {
  const { cancelDuplicates = true } = options;

  const existingController = pendingRequests.get(key);
  if (existingController) {
    if (cancelDuplicates) {
      existingController.abort();
      console.warn(`Cancelled duplicate request: ${key}`);
    } else {
      return false;
    }
  }

  pendingRequests.set(key, controller);
  return true;
};

const removePendingRequest = (key) => {
  pendingRequests.delete(key);
};

const isRequestPending = (key) => {
  return pendingRequests.has(key);
};

export const cancelRequest = (key) => {
  const controller = pendingRequests.get(key);
  if (controller) {
    controller.abort();
    removePendingRequest(key);
  }
};

export const cancelAllRequests = () => {
  pendingRequests.forEach((controller, key) => {
    controller.abort();
  });
  pendingRequests.clear();
};

export const getPendingRequests = () => {
  return Array.from(pendingRequests.keys());
};

// ==================================================
// Enhanced HTTP Methods with AbortController Support
// ==================================================

// Helper to create a unified config for all HTTP methods
const createRequestConfig = (config, options) => {
  const { signal, track = true, requestKey, excludeAuth = false } = options;

  const controller = signal ? null : new AbortController();
  const requestSignal = signal || controller?.signal;

  // Augment config with a 'meta' property to pass custom options to interceptors
  const augmentedConfig = {
    ...config,
    signal: requestSignal,
    meta: {
      ...config.meta,
      excludeAuth // Pass the excludeAuth flag
    }
  };

  return { augmentedConfig, controller, track, requestKey, requestSignal };
};


export const get = (url, config = {}, options = {}) => {
  const { augmentedConfig, controller, track, requestKey } = createRequestConfig(config, options);
  const key = requestKey || generateRequestKey('GET', url);

  if (track && controller) {
    addPendingRequest(key, controller);
  }

  return api.get(url, augmentedConfig)
    .finally(() => {
      if (track && controller) {
        removePendingRequest(key);
      }
    });
};

export const post = (url, data = {}, config = {}, options = {}) => {
  const { augmentedConfig, controller, track, requestKey } = createRequestConfig(config, options);
  const key = requestKey || generateRequestKey('POST', url, data);

  if (track && controller) {
    addPendingRequest(key, controller);
  }

  return api.post(url, data, augmentedConfig)
    .finally(() => {
      if (track && controller) {
        removePendingRequest(key);
      }
    });
};

export const put = (url, data = {}, config = {}, options = {}) => {
  const { augmentedConfig, controller, track, requestKey } = createRequestConfig(config, options);
  const key = requestKey || generateRequestKey('PUT', url, data);

  if (track && controller) {
    addPendingRequest(key, controller);
  }

  return api.put(url, data, augmentedConfig)
    .finally(() => {
      if (track && controller) {
        removePendingRequest(key);
      }
    });
};

export const del = (url, config = {}, options = {}) => {
  const { augmentedConfig, controller, track, requestKey } = createRequestConfig(config, options);
  const key = requestKey || generateRequestKey('DELETE', url);

  if (track && controller) {
    addPendingRequest(key, controller);
  }

  return api.delete(url, augmentedConfig)
    .finally(() => {
      if (track && controller) {
        removePendingRequest(key);
      }
    });
};

// ==================================================
// Enhanced File Upload Methods with AbortController Support
// ==================================================

export const postFormData = (url, formData, config = {}, options = {}) => {
  const { augmentedConfig, controller, track, requestKey } = createRequestConfig(config, options);
  const key = requestKey || generateRequestKey('POST_FORM', url);

  if (track && controller) {
    addPendingRequest(key, controller);
  }

  // Ensure multipart/form-data header is set
  augmentedConfig.headers = {
    ...augmentedConfig.headers,
    'Content-Type': 'multipart/form-data',
  };
  // Add onUploadProgress if provided in options
  if (options.onUploadProgress) {
      augmentedConfig.onUploadProgress = options.onUploadProgress;
  }


  return api.post(url, formData, augmentedConfig)
    .finally(() => {
      if (track && controller) {
        removePendingRequest(key);
      }
    });
};

export const putFormData = (url, formData, config = {}, options = {}) => {
  const { augmentedConfig, controller, track, requestKey } = createRequestConfig(config, options);
  const key = requestKey || generateRequestKey('PUT_FORM', url);

  if (track && controller) {
    addPendingRequest(key, controller);
  }

  // Ensure multipart/form-data header is set
  augmentedConfig.headers = {
    ...augmentedConfig.headers,
    'Content-Type': 'multipart/form-data',
  };
  // Add onUploadProgress if provided in options
  if (options.onUploadProgress) {
    augmentedConfig.onUploadProgress = options.onUploadProgress;
  }

  return api.put(url, formData, augmentedConfig)
    .finally(() => {
      if (track && controller) {
        removePendingRequest(key);
      }
    });
};

// ==================================================
// Request Building Utilities
// ==================================================

export const createCancellableRequest = (requestFn, options = {}) => {
  const { timeout, requestKey } = options;
  const { controller, signal } = createAbortController();

  let timeoutId;
  if (timeout) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);
  }

  const key = requestKey || `cancellable_${Date.now()}_${Math.random()}`;
  addPendingRequest(key, controller);

  // Pass the signal and any meta options from createCancellableRequest
  const promise = requestFn(signal, options.meta) // Assuming requestFn can accept meta options
    .finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
      removePendingRequest(key);
    });

  return {
    promise,
    cancel: () => controller.abort(),
    key,
    controller
  };
};

export const isAbortError = (error) => {
  return axios.isCancel(error) || error.name === 'AbortError' || error.name === 'CanceledError';
};

export const requestWithRetry = async (requestFn, options = {}) => {
  const {
    retries = 0,
    retryDelay = 1000,
    shouldRetry = (error) => !isAbortError(error) && error.response?.status >= 500,
    signal
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (signal?.aborted) {
        throw new Error('Request aborted');
      }

      return await requestFn(signal);
    } catch (error) {
      lastError = error;

      if (isAbortError(error)) {
        throw error;
      }

      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }

  throw lastError;
};

export const info = async (signal) => {
  // Example of using excludeAuth: if system-settings is a public endpoint
  return get(`/api/system-settings`, {}, { signal, excludeAuth: true });
};

// ==================================================
// Enhanced SECURITY AUTH with Token Management
// ==================================================

export const login = async (data, signal) => {
  // Login should never include an Authorization header
  const response = await post("/api/auth/login", data, {}, { signal, requestKey: 'auth_login', excludeAuth: true });

  // Store tokens after successful login
  if (response.data) {
    const { access_token, refresh_token, expires_in } = response.data;
    setTokens(access_token, refresh_token, expires_in);
  }

  return response;
};

export const logout = async (signal) => {
  try {
    // Assuming getCsrfCookie is a function that might also need excludeAuth if not token-based
    // await getCsrfCookie(signal, { excludeAuth: true }); // If getCsrfCookie exists and needs this
    await post("/api/auth/logout", {}, {}, { signal, requestKey: 'auth_logout' }); // This should typically include auth
  } finally {
    clearTokens();
    window.dispatchEvent(new CustomEvent('auth:logout', { detail: 'user_logout' }));
  }
};

export const register = async (userData, signal) => {
  // Register should never include an Authorization header initially
  const response = await post("/api/auth/register", userData, {}, { signal, requestKey: 'auth_register', excludeAuth: true });

  // Store tokens if registration returns them (often it does)
  if (response.data?.data?.access_token) {
    const { access_token, refresh_token, expires_in } = response.data.data;
    setTokens(access_token, refresh_token, expires_in);
  }

  return response;
};

export const passwordResetRequest = async (data, signal) => {
  // Password reset request typically doesn't require auth (it's for *getting* back in)
  return post("api/auth/change-password", data, {}, { signal, requestKey: 'auth_password_reset_request', excludeAuth: true });
};

export const refreshToken = async (signal) => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  // The refresh endpoint itself should NOT include an access token
  const response = await post("/api/auth/refresh", { refresh_token: refreshToken }, {}, { signal, excludeAuth: true });

  if (response.data?.data) {
    const { access_token, refresh_token, expires_in } = response.data.data;
    setTokens(access_token, refresh_token, expires_in);
  }

  return response;
};

// ==================================================
// Token Management Utilities (Export for external use)
// ==================================================
export const tokenUtils = {
  setTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  isTokenExpired
};

export default api;