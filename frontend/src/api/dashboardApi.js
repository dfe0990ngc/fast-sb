/* eslint-disable no-unused-vars */
import { get } from './api';

// ==================================================
// Dashboard API Endpoints
// ==================================================

/**
 * Get complete dashboard overview data
 * @param {AbortSignal} signal - AbortController signal for cancellation
 * @returns {Promise} Dashboard data including stats, trends, and activities
 */
export const getDashboardOverview = async (params = {}) => {
  const queryParams = new URLSearchParams(params).toString();
  return get(`/api/dashboard?${queryParams ? `${queryParams}` : ''}`, {}, { track: true, requestKey: 'dashboard_overview' });
};

/**
 * Get overview statistics (total franchises, routes, renewals, drops)
 * @param {Object} params - Query parameters { year?, month? }
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise} Statistics data
 */
export const getDashboardStats = async (params = {}, signal) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `/api/dashboard/stats${queryParams ? `?${queryParams}` : ''}`;
  
  return get(url, {}, { signal, track: true, requestKey: `dashboard_stats_${queryParams}` });
};

/**
 * Get franchise trends over time (new, renew, drop)
 * @param {Object} params - Query parameters { year?, months? }
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise} Trends data for chart
 */
export const getFranchiseTrends = async (params = {}, signal) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `/api/dashboard/trends${queryParams ? `?${queryParams}` : ''}`;
  
  return get(url, {}, { signal, track: true, requestKey: `dashboard_trends_${queryParams}` });
};

/**
 * Get status distribution (new, renew, drop counts)
 * @param {Object} params - Query parameters { year?, month? }
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise} Status distribution for pie chart
 */
export const getStatusDistribution = async (params = {}, signal) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `/api/dashboard/status-distribution${queryParams ? `?${queryParams}` : ''}`;
  
  return get(url, {}, { signal, track: true, requestKey: `dashboard_status_distribution_${queryParams}` });
};

/**
 * Get top routes by franchise count
 * @param {Object} params - Query parameters { limit?, year?, month? }
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise} Top routes data
 */
export const getTopRoutes = async (params = {}, signal) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `/api/dashboard/top-routes${queryParams ? `?${queryParams}` : ''}`;
  
  return get(url, {}, { signal, track: true, requestKey: `dashboard_top_routes_${queryParams}` });
};

/**
 * Get top vehicle makes/brands
 * @param {Object} params - Query parameters { limit?, year?, month? }
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise} Top makes data
 */
export const getTopMakes = async (params = {}, signal) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `/api/dashboard/top-makes${queryParams ? `?${queryParams}` : ''}`;
  
  return get(url, {}, { signal, track: true, requestKey: `dashboard_top_makes_${queryParams}` });
};

/**
 * Get recent franchise activities
 * @param {Object} params - Query parameters { limit? }
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise} Recent activities data
 */
export const getRecentActivities = async (params = {}, signal) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `/api/dashboard/recent-activities${queryParams ? `?${queryParams}` : ''}`;
  
  return get(url, {}, { signal, track: true, requestKey: `dashboard_recent_activities_${queryParams}` });
};

/**
 * Get franchises expiring soon
 * @param {Object} params - Query parameters { days?, limit? }
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise} Expiring franchises data
 */
export const getExpiringFranchises = async (params = {}, signal) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `/api/dashboard/expiring-franchises${queryParams ? `?${queryParams}` : ''}`;
  
  return get(url, {}, { signal, track: true, requestKey: `dashboard_expiring_${queryParams}` });
};

/**
 * Get route performance analysis
 * @param {Object} params - Query parameters { year? }
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise} Route performance data
 */
export const getRoutePerformance = async (params = {}, signal) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `/api/dashboard/route-performance${queryParams ? `?${queryParams}` : ''}`;
  
  return get(url, {}, { signal, track: true, requestKey: `dashboard_route_performance_${queryParams}` });
};

/**
 * Get monthly comparison statistics
 * @param {Object} params - Query parameters { year? }
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise} Monthly comparison data
 */
export const getMonthlyComparison = async (params = {}, signal) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `/api/dashboard/monthly-comparison${queryParams ? `?${queryParams}` : ''}`;
  
  return get(url, {}, { signal, track: true, requestKey: `dashboard_monthly_comparison_${queryParams}` });
};

// ==================================================
// Dashboard Export Functions
// ==================================================

/**
 * Export dashboard data as PDF
 * @param {Object} params - Export parameters
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise} PDF file blob
 */
export const exportDashboardPDF = async (params = {}, signal) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `/api/dashboard/export/pdf${queryParams ? `?${queryParams}` : ''}`;
  
  return get(url, { responseType: 'blob' }, { signal, track: true, requestKey: 'dashboard_export_pdf' });
};

/**
 * Export dashboard data as Excel
 * @param {Object} params - Export parameters
 * @param {AbortSignal} signal - AbortController signal
 * @returns {Promise} Excel file blob
 */
export const exportDashboardExcel = async (params = {}, signal) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `/api/dashboard/export/excel${queryParams ? `?${queryParams}` : ''}`;
  
  return get(url, { responseType: 'blob' }, { signal, track: true, requestKey: 'dashboard_export_excel' });
};

// ==================================================
// Helper Functions
// ==================================================

/**
 * Build query parameters object
 * @param {Object} filters - Filter object
 * @returns {Object} Clean query parameters
 */
export const buildQueryParams = (filters) => {
  const params = {};
  
  if (filters.year) params.year = filters.year;
  if (filters.month) params.month = filters.month;
  if (filters.months) params.months = filters.months;
  if (filters.limit) params.limit = filters.limit;
  if (filters.days) params.days = filters.days;
  
  return params;
};

/**
 * Format dashboard data for display
 * @param {Object} data - Raw dashboard data
 * @returns {Object} Formatted data
 */
export const formatDashboardData = (data) => {
  if (!data) return null;
  
  return {
    stats: data.stats || {},
    trends: data.trends || [],
    statusDistribution: data.status_distribution || [],
    topRoutes: data.top_routes || [],
    topMakes: data.top_makes || [],
    recentActivities: data.recent_activities || [],
    monthlyStats: data.monthly_stats || []
  };
};

/**
 * Calculate percentage change
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {number} Percentage change
 */
export const calculatePercentageChange = (current, previous) => {
  if (!previous || previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
};

/**
 * Format time ago string
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Formatted time ago
 */
export const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

export default {
  getDashboardOverview,
  getDashboardStats,
  getFranchiseTrends,
  getStatusDistribution,
  getTopRoutes,
  getTopMakes,
  getRecentActivities,
  getExpiringFranchises,
  getRoutePerformance,
  getMonthlyComparison,
  exportDashboardPDF,
  exportDashboardExcel,
  buildQueryParams,
  formatDashboardData,
  calculatePercentageChange,
  formatTimeAgo
};