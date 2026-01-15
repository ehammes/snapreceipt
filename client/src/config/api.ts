// API Configuration
// Uses environment variable for external API, empty string for same-domain API (Vercel)
export const API_BASE_URL = process.env.REACT_APP_API_URL || '';

// Detect if using local Express server (has REACT_APP_API_URL) or Vercel serverless (empty)
const isLocalDev = !!process.env.REACT_APP_API_URL;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth - different patterns for local Express vs Vercel serverless
  LOGIN: isLocalDev ? `${API_BASE_URL}/api/auth/login` : `${API_BASE_URL}/api/auth?action=login`,
  REGISTER: isLocalDev ? `${API_BASE_URL}/api/auth/register` : `${API_BASE_URL}/api/auth?action=register`,

  // Receipts
  RECEIPTS: `${API_BASE_URL}/api/receipts`,
  RECEIPT: (id: string) => `${API_BASE_URL}/api/receipts/${id}`,
  RECEIPT_ITEMS: (receiptId: string) => `${API_BASE_URL}/api/items?receiptId=${receiptId}`,
  RECEIPT_ITEM: (receiptId: string, itemId: string) => `${API_BASE_URL}/api/items/${itemId}?receiptId=${receiptId}`,
  UPLOAD: `${API_BASE_URL}/api/receipts/upload`,
  SAVE_GUEST: `${API_BASE_URL}/api/receipts/save-guest`,

  // Analytics (consolidated: use ?type=)
  ANALYTICS_SUMMARY: `${API_BASE_URL}/api/analytics?type=summary`,
  ANALYTICS_SUMMARY_METRICS: `${API_BASE_URL}/api/analytics?type=summary-metrics`,
  ANALYTICS_CATEGORY: `${API_BASE_URL}/api/analytics?type=category-breakdown`,
  ANALYTICS_MONTHLY: `${API_BASE_URL}/api/analytics?type=spending-timeline`,
  ANALYTICS_TOP_ITEMS: `${API_BASE_URL}/api/analytics?type=top-items`,
};
