import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  BarChart,
  PieChart,
  Line,
  Bar,
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
}

interface CategoryBreakdown {
  category: string;
  totalSpent: number;
  itemCount: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const AnalyticsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState<SpendingTimeline[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      const [timelineRes, topItemsRes, categoriesRes] = await Promise.all([
        fetch('http://localhost:3001/api/analytics/spending-timeline', { headers }),
        fetch('http://localhost:3001/api/analytics/top-items?limit=10', { headers }),
        fetch('http://localhost:3001/api/analytics/category-breakdown', { headers }),
      ]);

      if (!timelineRes.ok || !topItemsRes.ok || !categoriesRes.ok) {
        if (timelineRes.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch analytics data');
      }

      const [timelineData, topItemsData, categoriesData] = await Promise.all([
        timelineRes.json(),
        topItemsRes.json(),
        categoriesRes.json(),
      ]);

      setTimeline(timelineData.timeline || []);
      setTopItems(topItemsData.topItems || []);
      setCategories(categoriesData.categories || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  const totalSpent = timeline.reduce((sum, item) => sum + item.amount, 0);
  const totalCategories = categories.length;

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Total Spent Card */}
          <div className="bg-blue-50 rounded-lg p-6">
            <p className="text-blue-900 text-sm font-medium">Total Spent</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">
              {formatCurrency(totalSpent)}
            </p>
          </div>

          {/* Unique Items Card */}
          <div className="bg-green-50 rounded-lg p-6">
            <p className="text-green-900 text-sm font-medium">Unique Items</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {topItems.length}
            </p>
          </div>

          {/* Categories Card */}
          <div className="bg-purple-50 rounded-lg p-6">
            <p className="text-purple-900 text-sm font-medium">Categories</p>
            <p className="text-3xl font-bold text-purple-600 mt-1">
              {totalCategories}
            </p>
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

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 2: Most Purchased Items */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Most Purchased Items
            </h2>
            {topItems.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={topItems}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'Total Spent ($)') {
                        return [formatCurrency(Number(value)), name];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="quantity"
                    fill="#8884d8"
                    name="Quantity Purchased"
                  />
                  <Bar
                    dataKey="totalSpent"
                    fill="#82ca9d"
                    name="Total Spent ($)"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No item data available
              </div>
            )}
          </div>

          {/* Chart 3: Category Breakdown */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Spending by Category
            </h2>
            {categories.length > 0 ? (
              <div className="flex flex-col lg:flex-row items-center">
                <div className="w-full lg:w-1/2">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        // data={categories}
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
