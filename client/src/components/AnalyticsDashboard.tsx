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

  // Table sorting state
  const [sortBy, setSortBy] = useState<SortKey>('quantity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

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
        fetch('http://localhost:3001/api/analytics/spending-timeline', { headers }),
        fetch('http://localhost:3001/api/analytics/top-items?limit=10', { headers }),
        fetch('http://localhost:3001/api/analytics/category-breakdown', { headers }),
        fetch('http://localhost:3001/api/analytics/summary-metrics', { headers }),
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
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
          <p className="mt-4 text-gray-600 text-lg">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchAnalytics();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Spending Analytics</h1>
          <p className="text-gray-600 mt-1">Track your Costco spending patterns</p>
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          {/* Total Spent Card */}
          <div className="bg-blue-50 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-blue-900">Total Spent</h3>
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              ${summaryMetrics.totalSpent.toFixed(2)}
            </p>
          </div>

          {/* Total Items Card */}
          <div className="bg-green-50 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-green-900">Total Items</h3>
              <span className="text-2xl">📦</span>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {summaryMetrics.totalItems}
            </p>
            <p className="text-xs text-green-700 mt-1">items purchased</p>
          </div>

          {/* Unique Items Card */}
          <div className="bg-purple-50 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-purple-900">Unique Items</h3>
              <span className="text-2xl">✨</span>
            </div>
            <p className="text-3xl font-bold text-purple-600">
              {summaryMetrics.uniqueItems}
            </p>
            <p className="text-xs text-purple-700 mt-1">different products</p>
          </div>

          {/* Total Receipts Card */}
          <div className="bg-orange-50 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-orange-900">Total Receipts</h3>
              <span className="text-2xl">🧾</span>
            </div>
            <p className="text-3xl font-bold text-orange-600">
              {summaryMetrics.totalReceipts}
            </p>
            <p className="text-xs text-orange-700 mt-1">shopping trips</p>
          </div>

          {/* Average Per Receipt Card */}
          <div className="bg-teal-50 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-teal-900">Avg Per Receipt</h3>
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-3xl font-bold text-teal-600">
              ${summaryMetrics.averagePerReceipt.toFixed(2)}
            </p>
            <p className="text-xs text-teal-700 mt-1">per shopping trip</p>
          </div>
        </div>

        {/* Chart 1: Spending Over Time */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Spending Over Time
          </h2>
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
            <div className="h-64 flex items-center justify-center text-gray-500">
              No spending data available
            </div>
          )}
        </div>

        {/* Most Purchased Items Table */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Most Purchased Items
          </h2>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {sortedItems.length > 0 ? (
              sortedItems.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50 p-4 rounded-lg border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      {item.itemNumber && (
                        <span className="text-xs text-gray-400">#{item.itemNumber}</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-green-600">
                      ${item.totalSpent.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
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
                  <div className="grid grid-cols-3 gap-2 text-sm text-gray-500">
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
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="text-lg mb-2">No items yet</p>
                <p className="text-sm">
                  Upload receipts to see your most purchased items
                </p>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Purchased
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price Trend
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedItems.length > 0 ? (
                  sortedItems.map((item, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {item.quantity}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-green-600">
                          ${item.totalSpent.toFixed(2)}
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <p className="text-lg mb-2">No items yet</p>
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
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Spending by Category
          </h2>
          {categories.length > 0 ? (
            <div className="flex flex-col lg:flex-row items-center">
              <div className="w-full lg:w-1/2">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categories as any}
                      dataKey="totalSpent"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) =>
                        `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                      }
                      labelLine={false}
                    >
                      {categories.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value)), 'Spent']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category Legend */}
              <div className="w-full lg:w-1/2 mt-4 lg:mt-0 lg:pl-4">
                <div className="space-y-3">
                  {categories.map((cat, index) => (
                    <div
                      key={cat.category}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {cat.category}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrency(cat.totalSpent)}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({cat.itemCount} items)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No category data available
            </div>
          )}
        </div>

        {/* Empty State */}
        {timeline.length === 0 && topItems.length === 0 && categories.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center mt-6">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
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
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              No analytics data yet
            </h2>
            <p className="text-gray-600 mb-6">
              Upload some receipts to start seeing your spending analytics.
            </p>
            <button
              onClick={() => navigate('/upload')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
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
