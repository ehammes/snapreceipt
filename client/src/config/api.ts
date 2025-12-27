// API Configuration
// Uses environment variable in production, falls back to localhost for development
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,

  // Receipts
  RECEIPTS: `${API_BASE_URL}/api/receipts`,
  RECEIPT: (id: string) => `${API_BASE_URL}/api/receipts/${id}`,
  RECEIPT_ITEMS: (receiptId: string) => `${API_BASE_URL}/api/receipts/${receiptId}/items`,
  RECEIPT_ITEM: (receiptId: string, itemId: string) => `${API_BASE_URL}/api/receipts/${receiptId}/items/${itemId}`,
  UPLOAD: `${API_BASE_URL}/api/receipts/upload`,

  // Analytics
  ANALYTICS_SUMMARY: `${API_BASE_URL}/api/analytics/summary`,
  ANALYTICS_CATEGORY: `${API_BASE_URL}/api/analytics/by-category`,
  ANALYTICS_MONTHLY: `${API_BASE_URL}/api/analytics/monthly-trend`,
  ANALYTICS_TOP_ITEMS: `${API_BASE_URL}/api/analytics/top-items`,
};
