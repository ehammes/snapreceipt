const API_BASE_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api`;

// Helper to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Helper to handle API responses
const handleResponse = async (response: Response) => {
  const data = await response.json();

  if (!response.ok) {
    // Handle 401 Unauthorized - clear auth and redirect
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    throw new Error(data.error || 'An error occurred');
  }

  return data;
};

// Auth endpoints
export const authApi = {
  register: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    sessionStorage.removeItem('guestReceipt');
    window.location.href = '/login';
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },

  getToken: (): string | null => {
    return localStorage.getItem('token');
  },
};

// Receipt endpoints
export const receiptsApi = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append('receipt', file);

    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/receipts/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse(response);
  },

  getAll: async (filters?: {
    search?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
    category?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    const queryString = params.toString();
    const url = `${API_BASE_URL}/receipts${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getById: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/receipts/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  update: async (
    id: string,
    data: {
      storeName?: string;
      storeLocation?: string;
      storeCity?: string;
      storeState?: string;
      storeZip?: string;
      purchaseDate?: string;
    }
  ) => {
    const response = await fetch(`${API_BASE_URL}/receipts/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/receipts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  addItem: async (
    receiptId: string,
    item: {
      name: string;
      unitPrice: number;
      quantity: number;
      category?: string;
    }
  ) => {
    const response = await fetch(`${API_BASE_URL}/receipts/${receiptId}/items`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(item),
    });
    return handleResponse(response);
  },

  updateItem: async (
    receiptId: string,
    itemId: string,
    data: {
      name?: string;
      unitPrice?: number;
      quantity?: number;
      category?: string;
    }
  ) => {
    const response = await fetch(
      `${API_BASE_URL}/receipts/${receiptId}/items/${itemId}`,
      {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  deleteItem: async (receiptId: string, itemId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/receipts/${receiptId}/items/${itemId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );
    return handleResponse(response);
  },

  saveGuestReceipt: async (guestReceiptData: {
    imageUrl: string;
    storeName: string;
    storeLocation: string;
    storeCity: string;
    storeState: string;
    storeZip: string;
    purchaseDate: string;
    totalAmount: number;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      category?: string;
    }>;
  }) => {
    const response = await fetch(`${API_BASE_URL}/receipts/save-guest`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ guestReceiptData }),
    });
    return handleResponse(response);
  },
};

// Analytics endpoints
export const analyticsApi = {
  getSpendingTimeline: async () => {
    const response = await fetch(`${API_BASE_URL}/analytics/spending-timeline`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getTopItems: async (limit = 10) => {
    const response = await fetch(
      `${API_BASE_URL}/analytics/top-items?limit=${limit}`,
      {
        headers: getAuthHeaders(),
      }
    );
    return handleResponse(response);
  },

  getCategoryBreakdown: async () => {
    const response = await fetch(`${API_BASE_URL}/analytics/category-breakdown`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getSummary: async () => {
    const response = await fetch(`${API_BASE_URL}/analytics/summary`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getSummaryMetrics: async () => {
    const response = await fetch(`${API_BASE_URL}/analytics/summary-metrics`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

export default {
  auth: authApi,
  receipts: receiptsApi,
  analytics: analyticsApi,
};
