import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  PieChart,
  Line,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface SpendingTimeline {
  month: string;
  amount: number;
}

interface TopItem {
  name: string;
  quantity: number;
  totalSpent: number;
  purchaseCount: number;
  category: string;
  itemNumber: string;
  lastPurchased: string;
  priceChange: number;
}

interface CategoryBreakdown {
  category: string;
  totalSpent: number;
  itemCount: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Category color mapping for badges
const CATEGORY_COLORS: Record<string, string> = {
  'Groceries': 'bg-green-100 text-green-800',
  'Household': 'bg-blue-100 text-blue-800',
  'Electronics': 'bg-purple-100 text-purple-800',
  'Clothing': 'bg-pink-100 text-pink-800',
  'Health & Beauty': 'bg-rose-100 text-rose-800',
  'Frozen': 'bg-cyan-100 text-cyan-800',
  'Beverages': 'bg-amber-100 text-amber-800',
  'Snacks': 'bg-orange-100 text-orange-800',
  'Bakery': 'bg-yellow-100 text-yellow-800',
  'Meat & Seafood': 'bg-red-100 text-red-800',
  'Dairy': 'bg-indigo-100 text-indigo-800',
  'Uncategorized': 'bg-gray-100 text-gray-800',
};

// Helper to format date
const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

type SortKey = 'name' | 'quantity' | 'totalSpent';
type SortOrder = 'asc' | 'desc';

interface SummaryMetrics {
  totalSpent: number;
  totalItems: number;
  uniqueItems: number;
  totalReceipts: number;
  averagePerReceipt: number;
}

interface ReceiptItem {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  category: string | null;
}

interface Receipt {
  id: string;
  purchase_date: string;
  total_amount: number;
  store_name: string;
  store_location: string;
  store_city: string;
  store_state: string;
  items: ReceiptItem[];
}

const AnalyticsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState<SpendingTimeline[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics>({
    totalSpent: 0,
    totalItems: 0,
    uniqueItems: 0,
    totalReceipts: 0,
    averagePerReceipt: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Table sorting state
  const [sortBy, setSortBy] = useState<SortKey>('quantity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Expanded row state
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<Record<string, Array<{ date: string; price: number }>>>({});
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);

  // Sorted items
  const sortedItems = useMemo(() => {
    return [...topItems].sort((a, b) => {
      let aValue: string | number = a[sortBy];
      let bValue: string | number = b[sortBy];

      if (sortBy === 'name') {
        aValue = (aValue as string).toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [topItems, sortBy, sortOrder]);

  // Handle column sort
  const handleSort = (column: SortKey) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Fetch price history for an item
  const fetchPriceHistory = async (itemName: string, itemNumber: string) => {
    const rowKey = `${itemName}-${itemNumber}`;

    // If we already have the history, don't fetch again
    if (priceHistory[rowKey]) return;

    setLoadingHistory(rowKey);

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const data = await response.json();
      const receipts: Receipt[] = data.receipts || [];

      // Extract price history for this item from all receipts
      const history: Array<{ date: string; price: number }> = [];

      receipts.forEach((receipt) => {
        (receipt.items || []).forEach((item) => {
          // Match by item name (case insensitive) or item number
          const nameMatch = item.name.toLowerCase() === itemName.toLowerCase();
          const numberMatch = itemNumber && item.id && item.id === itemNumber;

          if (nameMatch || numberMatch) {
            history.push({
              date: receipt.purchase_date,
              price: Number(item.unit_price) || Number(item.total_price) / (item.quantity || 1),
            });
          }
        });
      });

      // Sort by date (most recent first)
      history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setPriceHistory((prev) => ({ ...prev, [rowKey]: history }));
    } catch (err) {
      console.error('Error fetching price history:', err);
    } finally {
      setLoadingHistory(null);
    }
  };

  // Handle row expansion
  const handleRowExpand = (itemName: string, itemNumber: string) => {
    const rowKey = `${itemName}-${itemNumber}`;

    if (expandedRow === rowKey) {
      setExpandedRow(null);
    } else {
      setExpandedRow(rowKey);
      fetchPriceHistory(itemName, itemNumber);
    }
  };

  // Auth check and fetch on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      const [timelineRes, topItemsRes, categoriesRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/analytics/spending-timeline`, { headers }),
        fetch(`${API_BASE_URL}/api/analytics/top-items?limit=10`, { headers }),
        fetch(`${API_BASE_URL}/api/analytics/category-breakdown`, { headers }),
        fetch(`${API_BASE_URL}/api/analytics/summary-metrics`, { headers }),
      ]);

      if (!timelineRes.ok || !topItemsRes.ok || !categoriesRes.ok || !metricsRes.ok) {
        if (timelineRes.status === 401 || metricsRes.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch analytics data');
      }

      const [timelineData, topItemsData, categoriesData, metricsData] = await Promise.all([
        timelineRes.json(),
        topItemsRes.json(),
        categoriesRes.json(),
        metricsRes.json(),
      ]);

      setTimeline(timelineData.timeline || []);
      setTopItems(topItemsData.topItems || []);
      setCategories(categoriesData.categories || []);
      setSummaryMetrics(metricsData);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  // CSV Export Functions
  const escapeCsvField = (field: string | number | null | undefined): string => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const exportReceiptsCSV = async () => {
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to export data');
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const receipts: Receipt[] = data.receipts || [];

      if (receipts.length === 0) {
        alert('No receipts to export');
        return;
      }

      const headers = ['Receipt ID', 'Purchase Date', 'Store Name', 'Store Location', 'City', 'State', 'Total Amount'];
      const rows = receipts.map((r) => [
        escapeCsvField(r.id),
        escapeCsvField(r.purchase_date ? new Date(r.purchase_date).toLocaleDateString() : ''),
        escapeCsvField(r.store_name),
        escapeCsvField(r.store_location),
        escapeCsvField(r.store_city),
        escapeCsvField(r.store_state),
        escapeCsvField(r.total_amount != null ? Number(r.total_amount).toFixed(2) : ''),
      ]);

      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
      downloadCSV(csv, 'receipts_export.csv');
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const exportItemsCSV = async () => {
    setExporting(true);
    setExportMenuOpen(false);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to export data');
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const receipts: Receipt[] = data.receipts || [];

      if (receipts.length === 0) {
        alert('No receipts to export');
        return;
      }

      const headers = ['Receipt ID', 'Purchase Date', 'Store Name', 'Item Name', 'Category', 'Quantity', 'Unit Price', 'Total Price'];
      const rows: string[][] = [];

      receipts.forEach((r) => {
        (r.items || []).forEach((item) => {
          rows.push([
            escapeCsvField(r.id),
            escapeCsvField(r.purchase_date ? new Date(r.purchase_date).toLocaleDateString() : ''),
            escapeCsvField(r.store_name),
            escapeCsvField(item.name),
            escapeCsvField(item.category || 'Uncategorized'),
            escapeCsvField(item.quantity),
            escapeCsvField(item.unit_price != null ? Number(item.unit_price).toFixed(2) : ''),
            escapeCsvField(item.total_price != null ? Number(item.total_price).toFixed(2) : ''),
          ]);
        });
      });

      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
      downloadCSV(csv, 'items_export.csv');
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto text-blue-600 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-4 text-lg text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <p className="mb-4 text-lg text-red-600">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchAnalytics();
            }}
            className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gray-100 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Spending Analytics</h1>
            <p className="mt-1 text-gray-500">Track your spending patterns and insights</p>
          </div>
          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Last updated: {new Date().toLocaleDateString()}
            </div>

            {/* Export Menu */}
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </>
                )}
              </button>

              {/* Dropdown Menu */}
              {exportMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setExportMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-20 w-56 mt-2 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-lg">
                    <div className="py-1">
                      <button
                        onClick={exportReceiptsCSV}
                        className="flex items-center w-full gap-3 px-4 py-3 text-sm text-left text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <div className="font-medium">Export Receipts</div>
                          <div className="text-xs text-gray-500">Receipt summaries as CSV</div>
                        </div>
                      </button>
                      <button
                        onClick={exportItemsCSV}
                        className="flex items-center w-full gap-3 px-4 py-3 text-sm text-left text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <div>
                          <div className="font-medium">Export All Items</div>
                          <div className="text-xs text-gray-500">Detailed item list as CSV</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* Total Spent Card */}
          <div className="p-6 bg-white border-l-4 border-blue-500 shadow-sm rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Total Spent</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ${summaryMetrics.totalSpent.toFixed(2)}
            </p>
          </div>

          {/* Total Items Card */}
          <div className="p-6 bg-white border-l-4 border-blue-400 shadow-sm rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Total Items</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {summaryMetrics.totalItems}
            </p>
            <p className="mt-1 text-xs text-gray-400">items purchased</p>
          </div>

          {/* Unique Items Card */}
          <div className="p-6 bg-white border-l-4 border-indigo-400 shadow-sm rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Unique Items</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {summaryMetrics.uniqueItems}
            </p>
            <p className="mt-1 text-xs text-gray-400">different products</p>
          </div>

          {/* Total Receipts Card */}
          <div className="p-6 bg-white border-l-4 shadow-sm rounded-xl border-sky-400">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-50">
                <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Total Receipts</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {summaryMetrics.totalReceipts}
            </p>
            <p className="mt-1 text-xs text-gray-400">shopping trips</p>
          </div>

          {/* Average Per Receipt Card */}
          <div className="p-6 bg-white border-l-4 shadow-sm rounded-xl border-violet-400">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-50">
                <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Avg Per Trip</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ${summaryMetrics.averagePerReceipt.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-gray-400">per shopping trip</p>
          </div>
        </div>

        {/* Chart 1: Spending Over Time */}
        <div className="p-4 mb-6 bg-white shadow-lg rounded-xl sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              Monthly Spending Over Time
            </h2>
          </div>
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `$${value}`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'Spending']}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="Monthly Spending"
                  dot={{ fill: '#8884d8', strokeWidth: 2 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No spending data available
            </div>
          )}
        </div>

        {/* Most Purchased Items Table */}
        <div className="p-4 mb-6 bg-white shadow-lg rounded-xl sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              Most Purchased Items
            </h2>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {sortedItems.length > 0 ? (
              sortedItems.map((item, index) => {
                const rowKey = `${item.name}-${item.itemNumber}`;
                const isExpanded = expandedRow === rowKey;
                const avgPrice = item.quantity > 0 ? item.totalSpent / item.quantity : 0;

                return (
                  <div
                    key={index}
                    className="overflow-hidden border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <div
                      onClick={() => handleRowExpand(item.name, item.itemNumber)}
                      className="p-4 cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <div>
                            <h3 className="font-medium text-gray-900">{item.name}</h3>
                            {item.itemNumber && (
                              <span className="text-xs text-gray-400">#{item.itemNumber}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-green-600">
                          ${Number(item.totalSpent).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-3 ml-6">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS['Uncategorized']}`}>
                          {item.category}
                        </span>
                        {item.priceChange !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-medium ${item.priceChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {item.priceChange > 0 ? '↑' : '↓'}
                            {Math.abs(item.priceChange).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 ml-6 text-sm text-gray-500">
                        <div>
                          <span className="block text-xs text-gray-400">Quantity</span>
                          <span className="font-semibold text-gray-900">
                            {item.quantity}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-400">Purchases</span>
                          <span>{item.purchaseCount}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-400">Last Bought</span>
                          <span className="text-xs">{formatDate(item.lastPurchased)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pt-2 pb-4 bg-white border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="p-3 rounded-lg bg-gray-50">
                            <p className="mb-1 text-xs text-gray-500">Average Price</p>
                            <p className="text-sm font-semibold text-gray-900">
                              ${avgPrice.toFixed(2)}
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-gray-50">
                            <p className="mb-1 text-xs text-gray-500">Price Trend</p>
                            {item.priceChange !== 0 ? (
                              <p className={`text-sm font-semibold ${item.priceChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {item.priceChange > 0 ? '↑' : '↓'} {Math.abs(item.priceChange).toFixed(1)}%
                              </p>
                            ) : (
                              <p className="text-sm font-semibold text-gray-500">No change</p>
                            )}
                          </div>
                        </div>

                        {/* Purchase History */}
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-medium text-gray-500">Purchase History</p>
                          {loadingHistory === rowKey ? (
                            <div className="flex items-center justify-center py-3 text-xs text-gray-400">
                              <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Loading...
                            </div>
                          ) : priceHistory[rowKey] && priceHistory[rowKey].length > 0 ? (
                            <div className="space-y-2">
                              {priceHistory[rowKey].map((entry, idx, arr) => {
                                // Compare to next entry (older purchase) since sorted most recent first
                                const olderPrice = idx < arr.length - 1 ? arr[idx + 1].price : null;
                                const change = olderPrice ? ((entry.price - olderPrice) / olderPrice) * 100 : null;

                                return (
                                  <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                                    <span className="text-xs text-gray-600">{formatDate(entry.date)}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-900">${entry.price.toFixed(2)}</span>
                                      {change !== null && (
                                        <span className={`text-xs font-medium ${change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                          {change > 0 ? '+' : ''}{change.toFixed(1)}%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="py-3 text-xs text-center text-gray-400">No history found</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-gray-500">
                <p className="mb-2 text-lg">No items yet</p>
                <p className="text-sm">
                  Upload receipts to see your most purchased items
                </p>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase transition-colors cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Product Name
                      {sortBy === 'name' && (
                        <span className="text-blue-600">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('quantity')}
                    className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase transition-colors cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Quantity
                      {sortBy === 'quantity' && (
                        <span className="text-blue-600">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('totalSpent')}
                    className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase transition-colors cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      Total Spent
                      {sortBy === 'totalSpent' && (
                        <span className="text-blue-600">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Last Purchased
                  </th>
                  <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Price Trend
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedItems.length > 0 ? (
                  sortedItems.map((item, index) => {
                    const rowKey = `${item.name}-${item.itemNumber}`;
                    const isExpanded = expandedRow === rowKey;
                    const avgPrice = item.quantity > 0 ? item.totalSpent / item.quantity : 0;

                    return (
                      <React.Fragment key={index}>
                        <tr
                          onClick={() => handleRowExpand(item.name, item.itemNumber)}
                          className="transition-colors cursor-pointer hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <div className="text-sm font-medium text-gray-900">
                                {item.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {item.quantity}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-green-600">
                              ${Number(item.totalSpent).toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS['Uncategorized']}`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {formatDate(item.lastPurchased)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.priceChange !== 0 ? (
                              <div className={`flex items-center gap-1 text-sm font-medium ${item.priceChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {item.priceChange > 0 ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                )}
                                {Math.abs(item.priceChange).toFixed(1)}%
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">—</div>
                            )}
                          </td>
                        </tr>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                {/* Item Number */}
                                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                                  <p className="mb-1 text-xs text-gray-500">Item Number</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {item.itemNumber || 'N/A'}
                                  </p>
                                </div>

                                {/* Purchase Count */}
                                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                                  <p className="mb-1 text-xs text-gray-500">Times Purchased</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {item.purchaseCount} {item.purchaseCount === 1 ? 'time' : 'times'}
                                  </p>
                                </div>

                                {/* Average Price */}
                                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                                  <p className="mb-1 text-xs text-gray-500">Average Price</p>
                                  <p className="text-sm font-semibold text-gray-900">
                                    ${avgPrice.toFixed(2)}
                                  </p>
                                </div>

                                {/* Price Trend Info */}
                                <div className="p-4 bg-white border border-gray-200 rounded-lg">
                                  <p className="mb-1 text-xs text-gray-500">Price Trend</p>
                                  {item.priceChange !== 0 ? (
                                    <p className={`text-sm font-semibold ${item.priceChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {item.priceChange > 0 ? '↑' : '↓'} {Math.abs(item.priceChange).toFixed(1)}% since first purchase
                                    </p>
                                  ) : (
                                    <p className="text-sm font-semibold text-gray-500">
                                      No change
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Price History */}
                              <div className="p-4 mt-4 bg-white border border-gray-200 rounded-lg">
                                <p className="mb-3 text-sm font-medium text-gray-700">Purchase History</p>
                                {loadingHistory === rowKey ? (
                                  <div className="flex items-center justify-center py-4 text-gray-400">
                                    <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Loading...
                                  </div>
                                ) : priceHistory[rowKey] && priceHistory[rowKey].length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-gray-200">
                                          <th className="px-3 py-2 text-xs font-medium text-left text-gray-500 uppercase">Date</th>
                                          <th className="px-3 py-2 text-xs font-medium text-right text-gray-500 uppercase">Price</th>
                                          <th className="px-3 py-2 text-xs font-medium text-right text-gray-500 uppercase">Change</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {priceHistory[rowKey].map((entry, idx, arr) => {
                                          // Compare to next entry (older purchase) since sorted most recent first
                                          const olderPrice = idx < arr.length - 1 ? arr[idx + 1].price : null;
                                          const change = olderPrice ? ((entry.price - olderPrice) / olderPrice) * 100 : null;

                                          return (
                                            <tr key={idx} className="border-b border-gray-100 last:border-0">
                                              <td className="px-3 py-2 text-gray-600">
                                                {formatDate(entry.date)}
                                              </td>
                                              <td className="px-3 py-2 font-medium text-right text-gray-900">
                                                ${entry.price.toFixed(2)}
                                              </td>
                                              <td className="px-3 py-2 text-right">
                                                {change !== null ? (
                                                  <span className={`text-xs font-medium ${change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                                                  </span>
                                                ) : (
                                                  <span className="text-xs text-gray-400">—</span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="py-4 text-sm text-center text-gray-400">No purchase history found</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <p className="mb-2 text-lg">No items yet</p>
                        <p className="text-sm">
                          Upload receipts to see your most purchased items
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="p-4 mb-6 bg-white shadow-lg rounded-xl sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              Spending by Category
            </h2>
          </div>
          {categories.length > 0 ? (
            <div className="flex flex-col items-start gap-6 md:flex-row">
              <div className="flex-shrink-0 w-full md:w-auto">
                <ResponsiveContainer width={280} height={280}>
                  <PieChart>
                    <Pie
                      data={categories as any}
                      dataKey="totalSpent"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                      label={({ percent }) =>
                        (percent || 0) > 0.05 ? `${((percent || 0) * 100).toFixed(0)}%` : ''
                      }
                      labelLine={false}
                    >
                      {categories.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          stroke="#fff"
                          strokeWidth={2}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        padding: '12px 16px',
                      }}
                      formatter={(value, name) => [
                        formatCurrency(Number(value)),
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category Legend */}
              <div className="flex-1 w-full">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {categories.map((cat, index) => (
                    <div
                      key={cat.category}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="flex-shrink-0 w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm font-medium text-gray-700 truncate">
                          {cat.category}
                        </span>
                      </div>
                      <div className="flex-shrink-0 ml-2 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(cat.totalSpent)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-500">
              No category data available
            </div>
          )}
        </div>

        {/* Empty State */}
        {timeline.length === 0 && topItems.length === 0 && categories.length === 0 && (
          <div className="p-8 mt-6 text-center bg-white shadow-lg rounded-xl">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h2 className="mb-2 text-xl font-semibold text-gray-800">
              No analytics data yet
            </h2>
            <p className="mb-6 text-gray-600">
              Upload some receipts to start seeing your spending analytics.
            </p>
            <button
              onClick={() => navigate('/upload')}
              className="px-6 py-3 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Upload Your First Receipt
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
