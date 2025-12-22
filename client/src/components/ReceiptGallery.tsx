import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

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
  user_id: string;
  image_url: string;
  purchase_date: string;
  upload_date: string;
  total_amount: number;
  store_name: string;
  store_location: string;
  store_city: string;
  store_state: string;
  store_zip: string;
  items: ReceiptItem[];
}

interface Filters {
  search: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  category: string;
}

const CATEGORIES = [
  'All Categories',
  'Groceries',
  'Electronics',
  'Household',
  'Clothing',
  'Health',
  'Other',
];

const ReceiptGallery: React.FC = () => {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    category: '',
  });

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:3001/api/receipts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch receipts');
      }

      const data = await response.json();
      setReceipts(data.receipts || []);
    } catch (err) {
      console.error('Error fetching receipts:', err);
      setError('Failed to load receipts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.startDate !== '' ||
      filters.endDate !== '' ||
      filters.minAmount !== '' ||
      filters.maxAmount !== '' ||
      filters.category !== ''
    );
  }, [filters]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    if (filters.category) count++;
    return count;
  }, [filters]);

  // Apply filters to receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      // Text search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const storeMatch = receipt.store_name?.toLowerCase().includes(searchLower);
        const itemMatch = receipt.items?.some(
          (item) =>
            item.name?.toLowerCase().includes(searchLower) ||
            item.category?.toLowerCase().includes(searchLower)
        );
        if (!storeMatch && !itemMatch) {
          return false;
        }
      }

      // Date range - start date
      if (filters.startDate) {
        const receiptDate = new Date(receipt.purchase_date);
        const startDate = new Date(filters.startDate);
        if (receiptDate < startDate) {
          return false;
        }
      }

      // Date range - end date
      if (filters.endDate) {
        const receiptDate = new Date(receipt.purchase_date);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // Include entire end date
        if (receiptDate > endDate) {
          return false;
        }
      }

      // Amount range - minimum
      if (filters.minAmount) {
        const minAmount = parseFloat(filters.minAmount);
        if (!isNaN(minAmount) && receipt.total_amount < minAmount) {
          return false;
        }
      }

      // Amount range - maximum
      if (filters.maxAmount) {
        const maxAmount = parseFloat(filters.maxAmount);
        if (!isNaN(maxAmount) && receipt.total_amount > maxAmount) {
          return false;
        }
      }

      // Category filter
      if (filters.category) {
        const hasCategory = receipt.items?.some(
          (item) => item.category?.toLowerCase() === filters.category.toLowerCase()
        );
        if (!hasCategory) {
          return false;
        }
      }

      return true;
    });
  }, [receipts, filters]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
      category: '',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${Number(amount).toFixed(2)}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600 text-lg">Loading receipts...</p>
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
              fetchReceipts();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state (no receipts at all)
  if (receipts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              No receipts uploaded yet
            </h2>
            <p className="text-gray-600 mb-6">
              Start tracking your Costco spending by uploading your first receipt.
            </p>
            <button
              onClick={() => navigate('/upload')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Upload Your First Receipt
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">My Receipts</h1>
          <button
            onClick={() => navigate('/upload')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Upload New Receipt
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow mb-4 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search receipts, items, or categories..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filters Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                hasActiveFilters
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat === 'All Categories' ? '' : cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Min Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={filters.minAmount}
                    onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Max Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="999.99"
                    value={filters.maxAmount}
                    onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Clear Filters Button */}
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4 text-gray-600">
          Showing {filteredReceipts.length} of {receipts.length} receipts
          {hasActiveFilters && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              filtered
            </span>
          )}
        </div>

        {/* Empty Filter State */}
        {filteredReceipts.length === 0 && receipts.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              No receipts match your filters
            </h2>
            <p className="text-gray-600 mb-6">
              Try adjusting your search or filter criteria.
            </p>
            <button
              onClick={clearFilters}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Clear Filters to See All Receipts
            </button>
          </div>
        )}

        {/* Receipts Grid */}
        {filteredReceipts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredReceipts.map((receipt) => (
              <div
                key={receipt.id}
                onClick={() => navigate(`/receipts/${receipt.id}`)}
                className="bg-white rounded-lg shadow cursor-pointer hover:shadow-xl transition-shadow duration-200 overflow-hidden"
              >
                {/* Receipt Image */}
                <div className="aspect-[3/4] bg-gray-100 overflow-hidden">
                  {receipt.image_url ? (
                    <img
                      src={`http://localhost:3001${receipt.image_url}`}
                      alt={`Receipt from ${receipt.store_name}`}
                      className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-lg text-gray-800 truncate">
                    {receipt.store_name || 'Costco'}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {formatDate(receipt.purchase_date)}
                  </p>
                  <p className="text-green-600 font-bold text-lg mt-1">
                    {formatCurrency(receipt.total_amount)}
                  </p>
                  <div className="flex justify-between items-center mt-2">
                    {receipt.items && receipt.items.length > 0 && (
                      <span className="text-xs text-gray-400">
                        {receipt.items.length} item{receipt.items.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      Uploaded {formatDate(receipt.upload_date)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiptGallery;
