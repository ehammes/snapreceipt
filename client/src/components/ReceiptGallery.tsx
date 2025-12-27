import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES_WITH_ALL } from '../constants/categories';

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
  storeName: string;
}

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
    storeName: '',
  });

  // Sort state
  const [sortBy, setSortBy] = useState<'purchase_date' | 'upload_date' | 'total'>('purchase_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

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
      filters.category !== '' ||
      filters.storeName !== ''
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
    if (filters.storeName) count++;
    return count;
  }, [filters]);

  // Get unique store names for filter dropdown
  const uniqueStoreNames = useMemo(() => {
    const stores = new Set<string>();
    receipts.forEach((receipt) => {
      if (receipt.store_name) {
        stores.add(receipt.store_name);
      }
    });
    return Array.from(stores).sort();
  }, [receipts]);

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

      // Store name filter
      if (filters.storeName) {
        if (receipt.store_name !== filters.storeName) {
          return false;
        }
      }

      return true;
    });
  }, [receipts, filters]);

  // Sort filtered receipts
  const sortedReceipts = useMemo(() => {
    return [...filteredReceipts].sort((a, b) => {
      let aValue: number, bValue: number;

      switch (sortBy) {
        case 'purchase_date':
          aValue = new Date(a.purchase_date).getTime();
          bValue = new Date(b.purchase_date).getTime();
          break;
        case 'upload_date':
          aValue = new Date(a.upload_date).getTime();
          bValue = new Date(b.upload_date).getTime();
          break;
        case 'total':
          aValue = a.total_amount;
          bValue = b.total_amount;
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [filteredReceipts, sortBy, sortOrder]);

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
      storeName: '',
    });
  };

  // Delete handlers
  const handleDeleteClick = (e: React.MouseEvent, receipt: Receipt) => {
    e.stopPropagation();
    setReceiptToDelete(receipt);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!receiptToDelete) return;

    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3001/api/receipts/${receiptToDelete.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete receipt');
      }

      // Remove from local state
      setReceipts(receipts.filter((r) => r.id !== receiptToDelete.id));
      setDeleteSuccess('Receipt deleted successfully');
      setDeleteModalOpen(false);
      setReceiptToDelete(null);

      // Clear success message after 3 seconds
      setTimeout(() => setDeleteSuccess(null), 3000);
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete receipt. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setReceiptToDelete(null);
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
              Start tracking your spending by uploading your first receipt.
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'purchase_date' | 'upload_date' | 'total')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="purchase_date">Purchase Date</option>
                <option value="upload_date">Upload Date</option>
                <option value="total">Total Amount</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                )}
              </button>
            </div>
            {/* Upload Button */}
            <button
              onClick={() => navigate('/upload')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
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

                {/* Store Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Store
                  </label>
                  <select
                    value={filters.storeName}
                    onChange={(e) => handleFilterChange('storeName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Stores</option>
                    {uniqueStoreNames.map((store) => (
                      <option key={store} value={store}>
                        {store}
                      </option>
                    ))}
                  </select>
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
                    {CATEGORIES_WITH_ALL.map((cat) => (
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
        {sortedReceipts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedReceipts.map((receipt) => (
              <div
                key={receipt.id}
                onClick={() => navigate(`/receipts/${receipt.id}`)}
                className="bg-white rounded-lg shadow cursor-pointer hover:shadow-xl transition-shadow duration-200 overflow-hidden relative group"
              >
                {/* Delete Button */}
                <button
                  onClick={(e) => handleDeleteClick(e, receipt)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete receipt"
                >
                  <svg
                    className="w-4 h-4 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>

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
                    {receipt.store_name || 'Store'}
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

        {/* Success Message */}
        {deleteSuccess && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
            {deleteSuccess}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && receiptToDelete && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              {/* Warning Icon */}
              <svg
                className="w-12 h-12 text-red-600 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>

              {/* Modal Content */}
              <h2 className="text-xl font-bold text-gray-800 text-center mb-2">
                Delete Receipt?
              </h2>
              <p className="text-gray-600 text-center mb-4">
                Are you sure you want to delete this receipt? This action cannot
                be undone. All items will also be deleted.
              </p>

              {/* Receipt Preview */}
              <div className="bg-gray-50 rounded-lg p-3 mb-6">
                <p className="font-medium text-gray-800">
                  {receiptToDelete.store_name || 'Store'}
                </p>
                <p className="text-sm text-gray-600">
                  {formatDate(receiptToDelete.purchase_date)}
                </p>
                <p className="text-green-600 font-bold">
                  {formatCurrency(receiptToDelete.total_amount)}
                </p>
                {receiptToDelete.items && receiptToDelete.items.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {receiptToDelete.items.length} item
                    {receiptToDelete.items.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <svg
                        className="w-5 h-5 animate-spin"
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
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiptGallery;
