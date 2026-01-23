/**
 * Application-wide constants
 * Centralized location for magic numbers and repeated values
 */

// Re-export categories
export * from './categories';

// ============================================
// FORM VALIDATION & INPUT CONSTRAINTS
// ============================================

/** Number of decimal places for currency values */
export const CURRENCY_DECIMAL_PLACES = 2;

/** Minimum value for price/discount inputs */
export const MIN_PRICE = 0;

/** Step value for decimal number inputs (0.01 = cents) */
export const PRICE_STEP = 0.01;

/** Minimum quantity for items */
export const MIN_QUANTITY = 1;

/** Maximum file upload size in bytes (10MB) */
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum file upload size display string */
export const MAX_UPLOAD_SIZE_DISPLAY = '10mb';

// ============================================
// DEFAULT FORM VALUES
// ============================================

/** Default quantity when adding a new item */
export const DEFAULT_QUANTITY = 1;

/** Default discount amount */
export const DEFAULT_DISCOUNT = 0;

// Note: DEFAULT_CATEGORY is exported from categories.ts

// ============================================
// CURRENCY FORMATTING
// ============================================

/** Format a number as USD currency */
export const formatCurrency = (amount: number): string => {
  return `$${Number(amount).toFixed(CURRENCY_DECIMAL_PLACES)}`;
};

/** Parse a currency string to number */
export const parseCurrency = (value: string): number => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

/** Round a number to currency precision */
export const roundToCurrency = (value: number): number => {
  return Math.round(value * 100) / 100;
};

// ============================================
// DATE FORMATTING
// ============================================

/** Format a date for input fields (YYYY-MM-DD) */
export const formatDateForInput = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
};

/** Format a date for display (e.g., "January 15, 2024") */
export const formatDateForDisplay = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// ============================================
// FILE VALIDATION
// ============================================

/** Allowed image file types for receipts */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
] as const;

/** Human-readable allowed file extensions */
export const ALLOWED_EXTENSIONS = 'JPG, PNG, HEIC';

/** Validate file size */
export const isFileSizeValid = (fileSize: number): boolean => {
  return fileSize <= MAX_UPLOAD_SIZE_BYTES;
};

/** Validate file type */
export const isFileTypeValid = (fileType: string): boolean => {
  return ALLOWED_IMAGE_TYPES.includes(fileType as any);
};

// ============================================
// API & BACKEND
// ============================================

/** JWT token storage key */
export const TOKEN_KEY = 'token';

/** API request timeout in milliseconds */
export const API_TIMEOUT_MS = 30000; // 30 seconds

// ============================================
// UI CONSTANTS
// ============================================

/** Number of receipts to show per page in gallery */
export const RECEIPTS_PER_PAGE = 20;

/** Debounce delay for search inputs (ms) */
export const SEARCH_DEBOUNCE_MS = 300;

/** Toast notification duration (ms) */
export const TOAST_DURATION_MS = 3000;

// ============================================
// VALIDATION MESSAGES
// ============================================

export const VALIDATION_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PRICE: 'Please enter a valid price',
  FILE_TOO_LARGE: `File size must be less than ${MAX_UPLOAD_SIZE_DISPLAY}`,
  INVALID_FILE_TYPE: `Please upload an image file (${ALLOWED_EXTENSIONS})`,
  MIN_QUANTITY: `Quantity must be at least ${MIN_QUANTITY}`,
  MIN_PRICE: `Price must be at least $${MIN_PRICE}`,
} as const;

// ============================================
// ERROR MESSAGES
// ============================================

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UPLOAD_FAILED: 'Failed to upload receipt. Please try again.',
  SAVE_FAILED: 'Failed to save changes. Please try again.',
  DELETE_FAILED: 'Failed to delete. Please try again.',
  UNAUTHORIZED: 'Session expired. Please log in again.',
  NOT_FOUND: 'Receipt not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
} as const;

// ============================================
// SUCCESS MESSAGES
// ============================================

export const SUCCESS_MESSAGES = {
  RECEIPT_UPLOADED: 'Receipt uploaded successfully!',
  RECEIPT_SAVED: 'Receipt saved successfully!',
  RECEIPT_DELETED: 'Receipt deleted successfully!',
  ITEM_ADDED: 'Item added successfully!',
  ITEM_UPDATED: 'Item updated successfully!',
  ITEM_DELETED: 'Item deleted successfully!',
} as const;
