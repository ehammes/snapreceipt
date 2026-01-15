import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES } from '../constants/categories';
import { API_BASE_URL } from '../config/api';

interface ReceiptItem {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  discount: number;
  total_price: number;
  category: string | null;
  item_number: string | null;
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

interface StoreForm {
  storeName: string;
  storeLocation: string;
  storeCity: string;
  storeState: string;
  storeZip: string;
}

interface ItemForm {
  name: string;
  unitPrice: string;
  quantity: string;
  discount: string;
  category: string;
}

const ReceiptDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imageZoomed, setImageZoomed] = useState(false);
  const [hoverZoom, setHoverZoom] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [editingStore, setEditingStore] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [saving, setSaving] = useState(false);

  const [storeForm, setStoreForm] = useState<StoreForm>({
    storeName: '',
    storeLocation: '',
    storeCity: '',
    storeState: '',
    storeZip: '',
  });

  const [itemForm, setItemForm] = useState<ItemForm>({
    name: '',
    unitPrice: '',
    quantity: '1',
    discount: '0',
    category: 'Groceries',
  });

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Item edit/delete state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState<ItemForm>({
    name: '',
    unitPrice: '',
    quantity: '1',
    discount: '0',
    category: '',
  });
  const [deleteItemModalOpen, setDeleteItemModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ReceiptItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  // Total amount edit state
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalForm, setTotalForm] = useState('');
  const [subtotalForm, setSubtotalForm] = useState('');
  const [taxForm, setTaxForm] = useState('');

  // Item sorting state
  const [itemSortBy, setItemSortBy] = useState<'receipt' | 'totalPrice'>('receipt');
  const [itemSortOrder, setItemSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchReceipt = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/receipts/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch receipt');
      }

      const data = await response.json();
      const receiptData = data.receipt;
      setReceipt(receiptData);

      // Initialize store form with receipt data
      setStoreForm({
        storeName: receiptData.store_name || '',
        storeLocation: receiptData.store_location || '',
        storeCity: receiptData.store_city || '',
        storeState: receiptData.store_state || '',
        storeZip: receiptData.store_zip || '',
      });
    } catch (err) {
      console.error('Error fetching receipt:', err);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (id) {
      fetchReceipt();
    }
  }, [id, fetchReceipt]);

  const handleSaveStoreInfo = async () => {
    if (!receipt) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/receipts/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(storeForm),
      });

      if (!response.ok) {
        throw new Error('Failed to update store info');
      }

      const data = await response.json();
      setReceipt(data.receipt);
      setEditingStore(false);
    } catch (err) {
      console.error('Error updating store info:', err);
      alert('Failed to update store information');
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!receipt || !itemForm.name || !itemForm.unitPrice) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/receipts/${id}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: itemForm.name,
          unitPrice: parseFloat(itemForm.unitPrice),
          quantity: parseInt(itemForm.quantity) || 1,
          discount: parseFloat(itemForm.discount) || 0,
          category: itemForm.category,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add item');
      }

      // Refetch receipt to get updated items and total
      await fetchReceipt();

      // Reset form and close
      setItemForm({
        name: '',
        unitPrice: '',
        quantity: '1',
        discount: '0',
        category: 'Groceries',
      });
      setAddingItem(false);
    } catch (err) {
      console.error('Error adding item:', err);
      alert('Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  // Sorted items memo
  const sortedItems = useMemo(() => {
    if (!receipt?.items) return [];

    const items = [...receipt.items];

    if (itemSortBy === 'receipt') {
      // Default receipt order - items are already in receipt order from API
      // Just apply asc/desc
      return itemSortOrder === 'asc' ? items : [...items].reverse();
    }

    // Sort by total price (unit_price * quantity)
    return items.sort((a, b) => {
      const totalA = a.unit_price * a.quantity;
      const totalB = b.unit_price * b.quantity;
      return itemSortOrder === 'asc' ? totalA - totalB : totalB - totalA;
    });
  }, [receipt?.items, itemSortBy, itemSortOrder]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${Number(amount).toFixed(2)}`;
  };

  // Delete handlers
  const handleDeleteClick = () => {
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!receipt) return;

    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/receipts/${receipt.id}`,
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

      // Navigate back to receipts
      navigate('/receipts');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete receipt. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
  };

  // Item edit handlers
  const handleEditItemClick = (item: ReceiptItem) => {
    setEditingItemId(item.id);
    setEditItemForm({
      name: item.name,
      unitPrice: String(item.unit_price),
      quantity: String(item.quantity),
      discount: String(item.discount || 0),
      category: item.category || 'Groceries',
    });
  };

  const handleEditItemCancel = () => {
    setEditingItemId(null);
    setEditItemForm({
      name: '',
      unitPrice: '',
      quantity: '1',
      discount: '0',
      category: '',
    });
  };

  const handleEditItemSave = async () => {
    if (!receipt || !editingItemId || !editItemForm.name || !editItemForm.unitPrice) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/receipts/${id}/items/${editingItemId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: editItemForm.name,
            unitPrice: parseFloat(editItemForm.unitPrice),
            quantity: parseInt(editItemForm.quantity) || 1,
            discount: parseFloat(editItemForm.discount) || 0,
            category: editItemForm.category,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      // Refetch receipt to get updated items and total
      await fetchReceipt();
      handleEditItemCancel();
    } catch (err) {
      console.error('Error updating item:', err);
      alert('Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  // Item delete handlers
  const handleDeleteItemClick = (item: ReceiptItem) => {
    setItemToDelete(item);
    setDeleteItemModalOpen(true);
  };

  const handleDeleteItemConfirm = async () => {
    if (!receipt || !itemToDelete) return;

    setDeletingItem(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/receipts/${id}/items/${itemToDelete.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      // Refetch receipt to get updated items and total
      await fetchReceipt();
      setDeleteItemModalOpen(false);
      setItemToDelete(null);
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Failed to delete item');
    } finally {
      setDeletingItem(false);
    }
  };

  const handleDeleteItemCancel = () => {
    setDeleteItemModalOpen(false);
    setItemToDelete(null);
  };

  // Calculate subtotal from items safely
  const calculateSubtotal = () => {
    if (!receipt?.items || receipt.items.length === 0) return 0;
    return receipt.items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
  };

  // Calculate tax as total minus subtotal
  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    return Math.max(0, (Number(receipt?.total_amount) || 0) - subtotal);
  };

  // Total amount edit handlers
  const handleEditTotalClick = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    setSubtotalForm(subtotal.toFixed(2));
    setTaxForm(tax.toFixed(2));
    setTotalForm(String(receipt?.total_amount || 0));
    setEditingTotal(true);
  };

  // Update total when subtotal or tax changes
  const handleSubtotalChange = (value: string) => {
    setSubtotalForm(value);
    const subtotal = parseFloat(value) || 0;
    const tax = parseFloat(taxForm) || 0;
    setTotalForm((subtotal + tax).toFixed(2));
  };

  const handleTaxChange = (value: string) => {
    setTaxForm(value);
    const subtotal = parseFloat(subtotalForm) || 0;
    const tax = parseFloat(value) || 0;
    setTotalForm((subtotal + tax).toFixed(2));
  };

  const handleSaveTotal = async () => {
    if (!receipt) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/receipts/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ totalAmount: parseFloat(totalForm) }),
      });

      if (!response.ok) {
        throw new Error('Failed to update total');
      }

      const data = await response.json();
      setReceipt(data.receipt);
      setEditingTotal(false);
    } catch (err) {
      console.error('Error updating total:', err);
      alert('Failed to update total amount');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEditTotal = () => {
    setEditingTotal(false);
    setTotalForm('');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600 text-lg">Loading receipt...</p>
      </div>
    );
  }

  // Not found state
  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Receipt not found</h2>
          <p className="text-gray-600 mb-4">The receipt you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/receipts')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Back to Receipts
          </button>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header with Back button and Actions menu */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => navigate('/receipts')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Receipts
          </button>

          {/* Actions Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleDeleteClick();
                    }}
                    className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
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
                    Delete Receipt
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Receipt Image */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:sticky lg:top-6 lg:self-start">
            <h2 className="font-semibold text-lg text-gray-800 mb-4">Receipt Image</h2>
            <div className="relative">
              {receipt.image_url ? (
                <>
                  <div className="relative">
                    {/* Main Image */}
                    <div className="relative overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={receipt.image_url.startsWith('data:') ? receipt.image_url : `${API_BASE_URL}${receipt.image_url}`}
                        alt={`Receipt from ${receipt.store_name || 'Store'} dated ${new Date(receipt.purchase_date).toLocaleDateString()}`}
                        className="w-full max-h-[800px] object-contain cursor-crosshair"
                        onClick={() => setImageZoomed(true)}
                        onMouseEnter={() => setHoverZoom(true)}
                        onMouseLeave={() => setHoverZoom(false)}
                        onMouseMove={(e) => {
                          const img = e.currentTarget;
                          const rect = img.getBoundingClientRect();
                          const x = ((e.clientX - rect.left) / rect.width) * 100;
                          const y = ((e.clientY - rect.top) / rect.height) * 100;
                          setZoomPosition({ x, y });
                        }}
                      />

                      {/* Hover indicator box showing magnified area - desktop only */}
                      {hoverZoom && (
                        <div
                          className="hidden lg:block absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                          style={{
                            width: '33.33%',
                            height: '33.33%',
                            left: `${Math.max(0, Math.min(66.67, zoomPosition.x - 16.67))}%`,
                            top: `${Math.max(0, Math.min(66.67, zoomPosition.y - 16.67))}%`,
                          }}
                        />
                      )}
                    </div>

                    {/* Zoom Panel - Absolutely positioned to the right, desktop only */}
                    {hoverZoom && (
                      <div
                        className="hidden lg:block absolute top-0 left-full ml-4 w-80 h-96 overflow-hidden rounded-lg bg-white border-4 border-blue-500 shadow-2xl pointer-events-none z-50"
                      >
                        <img
                          src={receipt.image_url.startsWith('data:') ? receipt.image_url : `${API_BASE_URL}${receipt.image_url}`}
                          alt="Zoomed view"
                          className="w-full h-full object-contain"
                          style={{
                            transform: 'scale(3.6)',
                            transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                    <span className="lg:hidden">Tap to zoom</span>
                    <span className="hidden lg:inline">Hover to magnify • Click to zoom</span>
                  </p>
                </>
              ) : (
                <div className="aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400 text-sm">No image available</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Receipt Details Header */}
            <h1 className="text-2xl font-bold text-gray-800">Receipt Details</h1>

            {/* Store Information Card */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-lg text-gray-800">Store Information</h2>
                {!editingStore && (
                  <button
                    onClick={() => setEditingStore(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingStore ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Store Name</label>
                    <input
                      type="text"
                      value={storeForm.storeName}
                      onChange={(e) => setStoreForm({ ...storeForm, storeName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={storeForm.storeLocation}
                      onChange={(e) => setStoreForm({ ...storeForm, storeLocation: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">City</label>
                      <input
                        type="text"
                        value={storeForm.storeCity}
                        onChange={(e) => setStoreForm({ ...storeForm, storeCity: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">State</label>
                      <input
                        type="text"
                        value={storeForm.storeState}
                        onChange={(e) => setStoreForm({ ...storeForm, storeState: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxLength={2}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      value={storeForm.storeZip}
                      onChange={(e) => setStoreForm({ ...storeForm, storeZip: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      maxLength={10}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveStoreInfo}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Store Info'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingStore(false);
                        setStoreForm({
                          storeName: receipt.store_name || '',
                          storeLocation: receipt.store_location || '',
                          storeCity: receipt.store_city || '',
                          storeState: receipt.store_state || '',
                          storeZip: receipt.store_zip || '',
                        });
                      }}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xl font-semibold text-gray-800">
                    {receipt.store_name || 'Store'}
                  </p>
                  {receipt.store_location && (
                    <p className="text-gray-600">{receipt.store_location}</p>
                  )}
                  {(receipt.store_city || receipt.store_state || receipt.store_zip) && (
                    <p className="text-gray-600">
                      {[receipt.store_city, receipt.store_state].filter(Boolean).join(', ')}
                      {receipt.store_zip && ` ${receipt.store_zip}`}
                    </p>
                  )}
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-gray-600">
                      <span className="text-gray-500">Purchase Date:</span>{' '}
                      {formatDate(receipt.purchase_date)}
                    </p>
                    <p className="text-gray-600">
                      <span className="text-gray-500">Uploaded:</span>{' '}
                      {formatDate(receipt.upload_date)}
                    </p>
                  </div>
                  {/* Subtotal, Tax, and Total */}
                  <div className="pt-3 border-t border-gray-200 space-y-2">
                    {/* Receipt Totals Header */}
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-gray-800">Receipt Totals</h3>
                      {!editingTotal && (
                        <button
                          onClick={handleEditTotalClick}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {editingTotal ? (
                      // Edit Mode - all fields editable
                      <div className="space-y-3">
                        {/* Editable Subtotal */}
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-sm">Subtotal</span>
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={subtotalForm}
                              onChange={(e) => handleSubtotalChange(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg pl-6 pr-2 py-1.5 text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        {/* Editable Tax */}
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-sm">Tax</span>
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={taxForm}
                              onChange={(e) => handleTaxChange(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg pl-6 pr-2 py-1.5 text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        {/* Total (auto-calculated) */}
                        <div className="pt-2 border-t border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-800 font-semibold">Total</span>
                            <span className="text-xl font-bold text-green-600">
                              {formatCurrency(parseFloat(totalForm) || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Save/Cancel buttons */}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleSaveTotal}
                            disabled={saving || !totalForm}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEditTotal}
                            disabled={saving}
                            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <>
                        {/* Subtotal - calculated from items */}
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-sm">Subtotal</span>
                          <span className="text-gray-700 font-medium">
                            {formatCurrency(calculateSubtotal())}
                          </span>
                        </div>

                        {/* Tax - calculated as total minus subtotal */}
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-sm">Tax</span>
                          <span className="text-gray-700 font-medium">
                            {formatCurrency(calculateTax())}
                          </span>
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <span className="text-gray-800 font-semibold">Total</span>
                          <span className="text-xl font-bold text-green-600">
                            {formatCurrency(receipt.total_amount)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Items List Card */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <h2 className="font-semibold text-lg text-gray-800">
                  Items ({receipt.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0})
                </h2>
                <div className="flex items-center gap-2">
                  <select
                    value={itemSortBy}
                    onChange={(e) => setItemSortBy(e.target.value as 'receipt' | 'totalPrice')}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="receipt">Receipt Order</option>
                    <option value="totalPrice">Total Price</option>
                  </select>
                  <button
                    onClick={() => setItemSortOrder(itemSortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-1 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded"
                    title={itemSortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {itemSortOrder === 'asc' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Items List */}
              {sortedItems.length > 0 ? (
                <div className="max-h-96 overflow-y-auto space-y-3 mb-4">
                  {sortedItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gray-50 rounded-lg p-3"
                    >
                      {editingItemId === item.id ? (
                        // Edit Mode
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Item Name</label>
                            <input
                              type="text"
                              value={editItemForm.name}
                              onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Unit Price</label>
                              <input
                                type="number"
                                step="0.01"
                                value={editItemForm.unitPrice}
                                onChange={(e) => setEditItemForm({ ...editItemForm, unitPrice: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                              <input
                                type="number"
                                min="1"
                                value={editItemForm.quantity}
                                onChange={(e) => setEditItemForm({ ...editItemForm, quantity: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Discount</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editItemForm.discount}
                                onChange={(e) => setEditItemForm({ ...editItemForm, discount: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Category</label>
                              <select
                                value={editItemForm.category}
                                onChange={(e) => setEditItemForm({ ...editItemForm, category: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                {CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleEditItemSave}
                              disabled={saving || !editItemForm.name || !editItemForm.unitPrice}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleEditItemCancel}
                              disabled={saving}
                              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {item.item_number && (
                                <span className="text-xs text-gray-400 font-mono">
                                  {item.item_number}
                                </span>
                              )}
                              <p className="font-medium text-gray-800">{item.name}</p>
                            </div>
                            <p className="text-sm text-gray-500">
                              {formatCurrency(item.unit_price)} × {item.quantity}
                              {item.discount > 0 && (
                                <span className="text-red-500"> - {formatCurrency(item.discount)}</span>
                              )}
                              {' '}= {formatCurrency(item.total_price)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {item.category && (
                                <span className="text-xs text-blue-600">
                                  {item.category}
                                </span>
                              )}
                              {item.discount > 0 && (
                                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                                  Discount: {formatCurrency(item.discount)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-green-600">
                              {formatCurrency(item.total_price)}
                            </span>
                            <button
                              onClick={() => handleEditItemClick(item)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit item"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteItemClick(item)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete item"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm mb-4">
                  No items added yet. Add items to track purchases.
                </p>
              )}

              {/* Add Item Form */}
              {addingItem ? (
                <div className="border-t border-gray-200 pt-4 space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Item Name</label>
                    <input
                      type="text"
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      placeholder="Enter item name"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Unit Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={itemForm.unitPrice}
                        onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })}
                        placeholder="0.00"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={itemForm.quantity}
                        onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Discount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemForm.discount}
                        onChange={(e) => setItemForm({ ...itemForm, discount: e.target.value })}
                        placeholder="0.00"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Category</label>
                    <select
                      value={itemForm.category}
                      onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleAddItem}
                      disabled={saving || !itemForm.name || !itemForm.unitPrice}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Item'}
                    </button>
                    <button
                      onClick={() => {
                        setAddingItem(false);
                        setItemForm({
                          name: '',
                          unitPrice: '',
                          quantity: '1',
                          discount: '0',
                          category: 'Groceries',
                        });
                      }}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingItem(true)}
                  className="w-full border-2 border-dashed border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-700 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
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
                  Add Item
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {imageZoomed && receipt.image_url && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setImageZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed receipt image"
        >
          <img
            src={receipt.image_url.startsWith('data:') ? receipt.image_url : `${API_BASE_URL}${receipt.image_url}`}
            alt={`Zoomed receipt from ${receipt.store_name || 'Store'}`}
            className="max-w-full max-h-full object-contain"
          />
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setImageZoomed(false)}
          >
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-receipt-title">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {/* Warning Icon */}
            <svg
              className="w-12 h-12 text-red-600 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>

            {/* Modal Content */}
            <h2 id="delete-receipt-title" className="text-xl font-bold text-gray-800 text-center mb-2">
              Delete Receipt?
            </h2>
            <p className="text-gray-600 text-center mb-4">
              Are you sure you want to delete this receipt? This action cannot
              be undone. All items will also be deleted.
            </p>

            {/* Receipt Preview */}
            <div className="bg-gray-50 rounded-lg p-3 mb-6">
              <p className="font-medium text-gray-800">
                {receipt.store_name || 'Store'}
              </p>
              <p className="text-sm text-gray-600">
                {formatDate(receipt.purchase_date)}
              </p>
              <p className="text-green-600 font-bold">
                {formatCurrency(receipt.total_amount)}
              </p>
              {receipt.items && receipt.items.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {receipt.items.reduce((sum, item) => sum + (item.quantity || 1), 0)} item
                  {receipt.items.reduce((sum, item) => sum + (item.quantity || 1), 0) !== 1 ? 's' : ''}
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

      {/* Delete Item Confirmation Modal */}
      {deleteItemModalOpen && itemToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-item-title">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            {/* Warning Icon */}
            <svg
              className="w-12 h-12 text-red-600 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>

            {/* Modal Content */}
            <h2 id="delete-item-title" className="text-xl font-bold text-gray-800 text-center mb-2">
              Delete Item?
            </h2>
            <p className="text-gray-600 text-center mb-4">
              Are you sure you want to delete this item? This action cannot be undone.
            </p>

            {/* Item Preview */}
            <div className="bg-gray-50 rounded-lg p-3 mb-6">
              <p className="font-medium text-gray-800">{itemToDelete.name}</p>
              <p className="text-sm text-gray-600">
                {formatCurrency(itemToDelete.unit_price)} × {itemToDelete.quantity}
              </p>
              <p className="text-green-600 font-bold">
                {formatCurrency(itemToDelete.total_price)}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteItemCancel}
                disabled={deletingItem}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItemConfirm}
                disabled={deletingItem}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingItem ? (
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
  );
};

export default ReceiptDetail;
