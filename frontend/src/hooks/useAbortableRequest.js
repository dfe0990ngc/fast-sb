import { useRef, useEffect, useCallback, useState } from 'react';
import { createAbortController, isAbortError } from '../api/api';

/**
 * Custom hook for managing abortable API requests in React components
 * Automatically cancels pending requests when component unmounts
 * 
 * @returns {Object} Hook utilities for making cancellable requests
 */
export const useAbortableRequest = () => {
  const controllersRef = useRef(new Map());

  /**
   * Creates a new cancellable request
   * @param {Function} requestFn - Function that makes the API request
   * @param {Object} options - Options for the request
   * @param {string} options.key - Unique key for this request (optional)
   * @param {number} options.timeout - Custom timeout in milliseconds
   * @returns {Object} { promise, cancel, key }
   */
  const createRequest = useCallback((requestFn, options = {}) => {
    const { key: customKey, timeout } = options;
    const { controller, signal } = createAbortController();
    
    // Generate unique key if not provided
    const key = customKey || `request_${Date.now()}_${Math.random()}`;
    
    // Store controller for cleanup
    controllersRef.current.set(key, controller);
    
    // Set custom timeout if provided
    let timeoutId;
    if (timeout) {
      timeoutId = setTimeout(() => {
        controller.abort();
      }, timeout);
    }
    
    // Create the request promise
    const promise = requestFn(signal)
      .finally(() => {
        // Cleanup
        if (timeoutId) clearTimeout(timeoutId);
        controllersRef.current.delete(key);
      });
    
    // Return request controls
    return {
      promise,
      cancel: () => {
        controller.abort();
        controllersRef.current.delete(key);
      },
      key,
      signal
    };
  }, []);

  /**
   * Cancels a specific request by key
   * @param {string} key - Request key to cancel
   */
  const cancelRequest = useCallback((key) => {
    const controller = controllersRef.current.get(key);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(key);
    }
  }, []);

  /**
   * Cancels all pending requests
   */
  const cancelAllRequests = useCallback(() => {
    controllersRef.current.forEach((controller, key) => {
      controller.abort();
    });
    controllersRef.current.clear();
  }, []);

  /**
   * Gets the list of pending request keys
   * @returns {string[]} Array of pending request keys
   */
  const getPendingKeys = useCallback(() => {
    return Array.from(controllersRef.current.keys());
  }, []);

  /**
   * Checks if a request is still pending
   * @param {string} key - Request key to check
   * @returns {boolean} True if request is pending
   */
  const isPending = useCallback((key) => {
    return controllersRef.current.has(key);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAllRequests();
    };
  }, [cancelAllRequests]);

  return {
    createRequest,
    cancelRequest,
    cancelAllRequests,
    getPendingKeys,
    isPending,
    isAbortError
  };
};

/**
 * Hook for making a single abortable request with state management
 * @param {Function} requestFn - Function that makes the API request
 * @param {Object} options - Options for the request
 * @param {boolean} options.immediate - Whether to execute immediately (default: false)
 * @param {Array} options.deps - Dependencies to trigger re-execution
 * @returns {Object} Request state and controls
 */
export const useAbortableState = (requestFn, options = {}) => {
  const { immediate = false, deps = [] } = options;
  const { createRequest, isAbortError } = useAbortableRequest();
  const [state, setState] = useState({
    data: null,
    loading: false,
    error: null
  });
  const currentRequestRef = useRef(null);

  const execute = useCallback(async (...args) => {
    // Cancel any existing request
    if (currentRequestRef.current) {
      currentRequestRef.current.cancel();
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const request = createRequest((signal) => requestFn(...args, signal));
      currentRequestRef.current = request;

      const result = await request.promise;
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (error) {
      if (!isAbortError(error)) {
        setState(prev => ({ ...prev, loading: false, error }));
      }
      throw error;
    } finally {
      currentRequestRef.current = null;
    }
  }, [requestFn, createRequest, isAbortError]);

  const cancel = useCallback(() => {
    if (currentRequestRef.current) {
      currentRequestRef.current.cancel();
      currentRequestRef.current = null;
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, ...deps]);

  return {
    ...state,
    execute,
    cancel,
    isLoading: state.loading
  };
};
