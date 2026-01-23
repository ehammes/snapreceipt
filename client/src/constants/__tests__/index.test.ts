import {
  formatCurrency,
  parseCurrency,
  roundToCurrency,
  isFileSizeValid,
  isFileTypeValid,
  formatDateForInput,
  formatDateForDisplay,
  CURRENCY_DECIMAL_PLACES,
  MAX_UPLOAD_SIZE_BYTES,
  MIN_PRICE,
  PRICE_STEP,
  MIN_QUANTITY,
  DEFAULT_QUANTITY,
  DEFAULT_DISCOUNT,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_SIZE_DISPLAY,
  TOKEN_KEY,
  API_TIMEOUT_MS,
  RECEIPTS_PER_PAGE,
  SEARCH_DEBOUNCE_MS,
  TOAST_DURATION_MS,
  VALIDATION_MESSAGES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '../index';

describe('Currency Utilities', () => {
  describe('formatCurrency', () => {
    it('formats whole numbers with 2 decimals', () => {
      expect(formatCurrency(10)).toBe('$10.00');
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(1000)).toBe('$1000.00');
    });

    it('formats decimals to 2 places', () => {
      expect(formatCurrency(10.5)).toBe('$10.50');
      expect(formatCurrency(10.99)).toBe('$10.99');
      expect(formatCurrency(0.5)).toBe('$0.50');
    });

    it('rounds to 2 decimal places', () => {
      expect(formatCurrency(10.126)).toBe('$10.13');
      expect(formatCurrency(10.124)).toBe('$10.12');
      expect(formatCurrency(10.125)).toBe('$10.13');
    });

    it('handles negative values', () => {
      expect(formatCurrency(-5.5)).toBe('$-5.50');
      expect(formatCurrency(-10)).toBe('$-10.00');
    });

    it('handles zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('handles very small numbers', () => {
      expect(formatCurrency(0.01)).toBe('$0.01');
      expect(formatCurrency(0.001)).toBe('$0.00');
    });

    it('handles large numbers', () => {
      expect(formatCurrency(999999.99)).toBe('$999999.99');
    });
  });

  describe('parseCurrency', () => {
    it('parses valid number strings', () => {
      expect(parseCurrency('10.50')).toBe(10.5);
      expect(parseCurrency('100')).toBe(100);
      expect(parseCurrency('0.01')).toBe(0.01);
    });

    it('returns 0 for invalid strings', () => {
      expect(parseCurrency('invalid')).toBe(0);
      expect(parseCurrency('')).toBe(0);
      expect(parseCurrency('abc123')).toBe(0);
    });

    it('handles negative values', () => {
      expect(parseCurrency('-5.5')).toBe(-5.5);
      expect(parseCurrency('-100')).toBe(-100);
    });

    it('handles edge cases', () => {
      expect(parseCurrency('0')).toBe(0);
      expect(parseCurrency('0.00')).toBe(0);
    });
  });

  describe('roundToCurrency', () => {
    it('rounds to 2 decimal places', () => {
      expect(roundToCurrency(10.126)).toBe(10.13);
      expect(roundToCurrency(10.124)).toBe(10.12);
      expect(roundToCurrency(10.125)).toBe(10.13);
    });

    it('handles floating point precision issues', () => {
      expect(roundToCurrency(0.1 + 0.2)).toBe(0.3);
      expect(roundToCurrency(29.6599999)).toBe(29.66);
      expect(roundToCurrency(0.1 + 0.1 + 0.1)).toBe(0.3);
    });

    it('handles whole numbers', () => {
      expect(roundToCurrency(10)).toBe(10);
      expect(roundToCurrency(100)).toBe(100);
    });

    it('handles negative values', () => {
      expect(roundToCurrency(-10.126)).toBe(-10.13);
    });

    it('handles zero', () => {
      expect(roundToCurrency(0)).toBe(0);
    });
  });
});

describe('File Validation', () => {
  describe('isFileSizeValid', () => {
    it('accepts files within size limit', () => {
      expect(isFileSizeValid(1024)).toBe(true);
      expect(isFileSizeValid(1024 * 1024)).toBe(true); // 1MB
      expect(isFileSizeValid(MAX_UPLOAD_SIZE_BYTES)).toBe(true);
    });

    it('rejects files exceeding size limit', () => {
      expect(isFileSizeValid(MAX_UPLOAD_SIZE_BYTES + 1)).toBe(false);
      expect(isFileSizeValid(MAX_UPLOAD_SIZE_BYTES * 2)).toBe(false);
    });

    it('handles edge cases', () => {
      expect(isFileSizeValid(0)).toBe(true);
      expect(isFileSizeValid(MAX_UPLOAD_SIZE_BYTES - 1)).toBe(true);
    });
  });

  describe('isFileTypeValid', () => {
    it('accepts allowed image types', () => {
      expect(isFileTypeValid('image/jpeg')).toBe(true);
      expect(isFileTypeValid('image/jpg')).toBe(true);
      expect(isFileTypeValid('image/png')).toBe(true);
      expect(isFileTypeValid('image/heic')).toBe(true);
    });

    it('rejects disallowed file types', () => {
      expect(isFileTypeValid('application/pdf')).toBe(false);
      expect(isFileTypeValid('text/plain')).toBe(false);
      expect(isFileTypeValid('video/mp4')).toBe(false);
      expect(isFileTypeValid('application/json')).toBe(false);
    });

    it('is case sensitive', () => {
      expect(isFileTypeValid('image/JPEG')).toBe(false);
      expect(isFileTypeValid('IMAGE/jpeg')).toBe(false);
    });

    it('handles empty string', () => {
      expect(isFileTypeValid('')).toBe(false);
    });
  });
});

describe('Date Formatting', () => {
  describe('formatDateForInput', () => {
    it('formats Date object to YYYY-MM-DD', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      expect(formatDateForInput(date)).toBe('2025-01-15');
    });

    it('formats date string to YYYY-MM-DD', () => {
      expect(formatDateForInput('2025-01-15T10:30:00Z')).toBe('2025-01-15');
      expect(formatDateForInput('2025-12-31T23:59:59Z')).toBe('2025-12-31');
    });

    it('handles different date formats', () => {
      const date = new Date(2025, 0, 15); // January is 0
      const formatted = formatDateForInput(date);
      expect(formatted).toMatch(/2025-01-15/);
    });
  });

  describe('formatDateForDisplay', () => {
    it('formats date for display', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const formatted = formatDateForDisplay(date);
      expect(formatted).toContain('January');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2025');
    });

    it('formats date string for display', () => {
      const formatted = formatDateForDisplay('2025-12-25T00:00:00Z');
      expect(formatted).toContain('December');
      expect(formatted).toContain('25');
      expect(formatted).toContain('2025');
    });

    it('uses US date format', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const formatted = formatDateForDisplay(date);
      // US format: "January 15, 2025"
      expect(formatted).toMatch(/\w+ \d{1,2}, \d{4}/);
    });
  });
});

describe('Constants', () => {
  describe('Currency Constants', () => {
    it('defines currency decimal places', () => {
      expect(CURRENCY_DECIMAL_PLACES).toBe(2);
      expect(typeof CURRENCY_DECIMAL_PLACES).toBe('number');
    });

    it('defines minimum price', () => {
      expect(MIN_PRICE).toBe(0);
      expect(typeof MIN_PRICE).toBe('number');
    });

    it('defines price step', () => {
      expect(PRICE_STEP).toBe(0.01);
      expect(typeof PRICE_STEP).toBe('number');
    });
  });

  describe('Quantity Constants', () => {
    it('defines minimum quantity', () => {
      expect(MIN_QUANTITY).toBe(1);
      expect(typeof MIN_QUANTITY).toBe('number');
    });

    it('defines default quantity', () => {
      expect(DEFAULT_QUANTITY).toBe(1);
      expect(typeof DEFAULT_QUANTITY).toBe('number');
    });

    it('defines default discount', () => {
      expect(DEFAULT_DISCOUNT).toBe(0);
      expect(typeof DEFAULT_DISCOUNT).toBe('number');
    });
  });

  describe('File Upload Constants', () => {
    it('defines max upload size in bytes', () => {
      expect(MAX_UPLOAD_SIZE_BYTES).toBe(10485760); // 10MB in bytes
      expect(typeof MAX_UPLOAD_SIZE_BYTES).toBe('number');
    });

    it('defines max upload size display string', () => {
      expect(MAX_UPLOAD_SIZE_DISPLAY).toBe('10mb');
      expect(typeof MAX_UPLOAD_SIZE_DISPLAY).toBe('string');
    });

    it('defines allowed image types', () => {
      expect(Array.isArray(ALLOWED_IMAGE_TYPES)).toBe(true);
      expect(ALLOWED_IMAGE_TYPES.length).toBe(4);
      expect(ALLOWED_IMAGE_TYPES).toContain('image/jpeg');
      expect(ALLOWED_IMAGE_TYPES).toContain('image/jpg');
      expect(ALLOWED_IMAGE_TYPES).toContain('image/png');
      expect(ALLOWED_IMAGE_TYPES).toContain('image/heic');
    });

    it('defines allowed extensions string', () => {
      expect(ALLOWED_EXTENSIONS).toBe('JPG, PNG, HEIC');
      expect(typeof ALLOWED_EXTENSIONS).toBe('string');
    });
  });

  describe('API Constants', () => {
    it('defines token key', () => {
      expect(TOKEN_KEY).toBe('token');
      expect(typeof TOKEN_KEY).toBe('string');
    });

    it('defines API timeout', () => {
      expect(API_TIMEOUT_MS).toBe(30000);
      expect(typeof API_TIMEOUT_MS).toBe('number');
    });
  });

  describe('UI Constants', () => {
    it('defines receipts per page', () => {
      expect(RECEIPTS_PER_PAGE).toBe(20);
      expect(typeof RECEIPTS_PER_PAGE).toBe('number');
    });

    it('defines search debounce delay', () => {
      expect(SEARCH_DEBOUNCE_MS).toBe(300);
      expect(typeof SEARCH_DEBOUNCE_MS).toBe('number');
    });

    it('defines toast duration', () => {
      expect(TOAST_DURATION_MS).toBe(3000);
      expect(typeof TOAST_DURATION_MS).toBe('number');
    });
  });
});

describe('Validation Messages', () => {
  it('defines required field message', () => {
    expect(VALIDATION_MESSAGES.REQUIRED_FIELD).toBe('This field is required');
  });

  it('defines invalid email message', () => {
    expect(VALIDATION_MESSAGES.INVALID_EMAIL).toBe('Please enter a valid email address');
  });

  it('defines invalid price message', () => {
    expect(VALIDATION_MESSAGES.INVALID_PRICE).toBe('Please enter a valid price');
  });

  it('defines file too large message with size reference', () => {
    expect(VALIDATION_MESSAGES.FILE_TOO_LARGE).toContain(MAX_UPLOAD_SIZE_DISPLAY);
  });

  it('defines invalid file type message with extensions', () => {
    expect(VALIDATION_MESSAGES.INVALID_FILE_TYPE).toContain(ALLOWED_EXTENSIONS);
  });

  it('defines min quantity message with value', () => {
    expect(VALIDATION_MESSAGES.MIN_QUANTITY).toContain(String(MIN_QUANTITY));
  });

  it('defines min price message with value', () => {
    expect(VALIDATION_MESSAGES.MIN_PRICE).toContain(String(MIN_PRICE));
  });
});

describe('Error Messages', () => {
  it('defines network error message', () => {
    expect(ERROR_MESSAGES.NETWORK_ERROR).toBeTruthy();
    expect(typeof ERROR_MESSAGES.NETWORK_ERROR).toBe('string');
  });

  it('defines upload failed message', () => {
    expect(ERROR_MESSAGES.UPLOAD_FAILED).toBeTruthy();
    expect(typeof ERROR_MESSAGES.UPLOAD_FAILED).toBe('string');
  });

  it('defines save failed message', () => {
    expect(ERROR_MESSAGES.SAVE_FAILED).toBeTruthy();
    expect(typeof ERROR_MESSAGES.SAVE_FAILED).toBe('string');
  });

  it('defines delete failed message', () => {
    expect(ERROR_MESSAGES.DELETE_FAILED).toBeTruthy();
    expect(typeof ERROR_MESSAGES.DELETE_FAILED).toBe('string');
  });

  it('defines unauthorized message', () => {
    expect(ERROR_MESSAGES.UNAUTHORIZED).toBeTruthy();
    expect(typeof ERROR_MESSAGES.UNAUTHORIZED).toBe('string');
  });

  it('defines not found message', () => {
    expect(ERROR_MESSAGES.NOT_FOUND).toBeTruthy();
    expect(typeof ERROR_MESSAGES.NOT_FOUND).toBe('string');
  });

  it('defines server error message', () => {
    expect(ERROR_MESSAGES.SERVER_ERROR).toBeTruthy();
    expect(typeof ERROR_MESSAGES.SERVER_ERROR).toBe('string');
  });
});

describe('Success Messages', () => {
  it('defines receipt uploaded message', () => {
    expect(SUCCESS_MESSAGES.RECEIPT_UPLOADED).toBeTruthy();
    expect(typeof SUCCESS_MESSAGES.RECEIPT_UPLOADED).toBe('string');
  });

  it('defines receipt saved message', () => {
    expect(SUCCESS_MESSAGES.RECEIPT_SAVED).toBeTruthy();
    expect(typeof SUCCESS_MESSAGES.RECEIPT_SAVED).toBe('string');
  });

  it('defines receipt deleted message', () => {
    expect(SUCCESS_MESSAGES.RECEIPT_DELETED).toBeTruthy();
    expect(typeof SUCCESS_MESSAGES.RECEIPT_DELETED).toBe('string');
  });

  it('defines item added message', () => {
    expect(SUCCESS_MESSAGES.ITEM_ADDED).toBeTruthy();
    expect(typeof SUCCESS_MESSAGES.ITEM_ADDED).toBe('string');
  });

  it('defines item updated message', () => {
    expect(SUCCESS_MESSAGES.ITEM_UPDATED).toBeTruthy();
    expect(typeof SUCCESS_MESSAGES.ITEM_UPDATED).toBe('string');
  });

  it('defines item deleted message', () => {
    expect(SUCCESS_MESSAGES.ITEM_DELETED).toBeTruthy();
    expect(typeof SUCCESS_MESSAGES.ITEM_DELETED).toBe('string');
  });
});
