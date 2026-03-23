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
  purchaseDate: string;
}

interface ItemForm {
  itemNumber: string;
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

    purchaseDate: '',
  });

  const [itemForm, setItemForm] = useState<ItemForm>({
    itemNumber: '',
    name: '',
    unitPrice: '',
    quantity: '1',
    discount: '0',
    category: 'Uncategorized',
  });

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Item edit/delete state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState<ItemForm>({
    itemNumber: '',
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

  // Drag and drop state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Lock in initial tax when receipt loads (stays constant unless manually edited)
  const [lockedTax, setLockedTax] = useState<number>(0);

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

      // Lock in the initial tax amount (Total - Items)
      const itemsTotal = receiptData.items?.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0) || 0;
      const initialTax = Math.max(0, (Number(receiptData.total_amount) || 0) - itemsTotal);
      setLockedTax(Math.round(initialTax * 100) / 100); // Round to 2 decimal places

      // Initialize store form with receipt data
      setStoreForm({
        storeName: receiptData.store_name || '',
        storeLocation: receiptData.store_location || '',
        storeCity: receiptData.store_city || '',
        storeState: receiptData.store_state || '',
        storeZip: receiptData.store_zip || '',
        purchaseDate: receiptData.purchase_date || '',
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
      const response = await fetch(`${API_BASE_URL}/api/items?receiptId=${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemNumber: itemForm.itemNumber,
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

      // Calculate new total: (current items + new item) + locked tax
      const currentSubtotal = calculateSubtotal();
      const newItemTotal = Math.round((parseFloat(itemForm.unitPrice) * (parseInt(itemForm.quantity) || 1) - (parseFloat(itemForm.discount) || 0)) * 100) / 100;
      const newTotal = Math.round((currentSubtotal + newItemTotal + lockedTax) * 100) / 100;

      // Update total on backend
      await fetch(`${API_BASE_URL}/api/receipts/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ totalAmount: newTotal }),
      });

      // Refetch receipt to get updated items and total
      await fetchReceipt();

      // Reset form and close
      setItemForm({
        itemNumber: '',
        name: '',
        unitPrice: '',
        quantity: '1',
        discount: '0',
        category: 'Uncategorized',
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

  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
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
      itemNumber: item.item_number || '',
      name: item.name,
      unitPrice: String(item.unit_price),
      quantity: String(item.quantity),
      discount: String(item.discount || 0),
      category: item.category || 'Uncategorized',
    });
  };

  const handleEditItemCancel = () => {
    setEditingItemId(null);
    setEditItemForm({
      itemNumber: '',
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
        `${API_BASE_URL}/api/items/${editingItemId}?receiptId=${id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            itemNumber: editItemForm.itemNumber,
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

      // Fetch updated receipt data
      const receiptResponse = await fetch(`${API_BASE_URL}/api/receipts/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const receiptData = await receiptResponse.json();
      const updatedItems = receiptData.receipt.items;

      // Calculate new total: items + locked tax
      const newSubtotal = updatedItems.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0);
      const newTotal = Math.round((newSubtotal + lockedTax) * 100) / 100;

      // Update total on backend
      await fetch(`${API_BASE_URL}/api/receipts/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ totalAmount: newTotal }),
      });

      // Refetch to update UI
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
        `${API_BASE_URL}/api/items/${itemToDelete.id}?receiptId=${id}`,
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

      // Fetch updated receipt data
      const receiptResponse = await fetch(`${API_BASE_URL}/api/receipts/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const receiptData = await receiptResponse.json();
      const updatedItems = receiptData.receipt.items;

      // Calculate new total: items + locked tax
      const newSubtotal = updatedItems.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0);
      const newTotal = Math.round((newSubtotal + lockedTax) * 100) / 100;

      // Update total on backend
      await fetch(`${API_BASE_URL}/api/receipts/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ totalAmount: newTotal }),
      });

      // Refetch to update UI
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

  // Drag and drop handlers (only active in receipt order mode)
  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItemId(itemId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverItemId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, dropItemId: string) => {
    e.preventDefault();
    setDragOverItemId(null);

    if (!draggedItemId || draggedItemId === dropItemId || !receipt) return;

    const draggedIndex = sortedItems.findIndex(item => item.id === draggedItemId);
    const dropIndex = sortedItems.findIndex(item => item.id === dropItemId);

    if (draggedIndex === -1 || dropIndex === -1) return;

    const newItems = [...sortedItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);

    const itemOrderUpdates = newItems.map((item, index) => ({
      id: item.id,
      item_order: index,
    }));

    // Optimistically update UI
    setReceipt({ ...receipt, items: newItems });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/items/reorder?receiptId=${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: itemOrderUpdates }),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder items');
      }

      await fetchReceipt();
    } catch (err) {
      console.error('Error reordering items:', err);
      alert('Failed to reorder items');
      await fetchReceipt();
    } finally {
      setDraggedItemId(null);
    }
  }, [draggedItemId, sortedItems, receipt, id, fetchReceipt]);

  const handleDragEnd = useCallback(() => {
    setDraggedItemId(null);
    setDragOverItemId(null);
  }, []);

  // Calculate subtotal from items safely
  const calculateSubtotal = () => {
    if (!receipt?.items || receipt.items.length === 0) return 0;
    return receipt.items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
  };

  // Return locked tax value (stays constant when items change)
  const calculateTax = () => {
    return lockedTax;
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

  // Update total when tax changes
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
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-lg text-gray-600">Loading receipt...</p>
      </div>
    );
  }

  // Not found state
  if (notFound) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-gray-800">Receipt not found</h2>
          <p className="mb-4 text-gray-600">The receipt you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/receipts')}
            className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
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
    <div className="min-h-screen p-4 bg-gray-100 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header with Back button and Actions menu */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/receipts')}
            className="flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-800"
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
              className="p-2 text-gray-500 transition-colors rounded-lg hover:text-gray-700 hover:bg-gray-100"
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
                <div className="absolute right-0 z-20 w-48 py-1 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleDeleteClick();
                    }}
                    className="flex items-center w-full gap-2 px-4 py-2 text-left text-red-600 transition-colors hover:bg-red-50"
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column - Receipt Image */}
          <div className="p-4 bg-white shadow-lg rounded-xl sm:p-6 lg:sticky lg:top-6 lg:self-start">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">Receipt Image</h2>
            <div className="relative">
              {receipt.image_url ? (
                <>
                  <div className="relative">
                    {/* Main Image */}
                    <div className="relative overflow-hidden bg-gray-100 rounded-lg">
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
                          className="absolute hidden border-2 border-blue-500 pointer-events-none lg:block bg-blue-500/10"
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
                        className="absolute top-0 z-50 hidden ml-4 overflow-hidden bg-white border-4 border-blue-500 rounded-lg shadow-2xl pointer-events-none lg:block left-full w-80 h-96"
                      >
                        <img
                          src={receipt.image_url.startsWith('data:') ? receipt.image_url : `${API_BASE_URL}${receipt.image_url}`}
                          alt="Zoomed view"
                          className="object-contain w-full h-full"
                          style={{
                            transform: 'scale(3.6)',
                            transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <p className="flex items-center justify-center gap-1 mt-2 text-xs text-center text-gray-400">
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
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-gray-400">No image available</p>
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
            <div className="p-4 bg-white shadow-lg rounded-xl sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Store Information</h2>
                {!editingStore && (
                  <button
                    onClick={() => setEditingStore(true)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingStore ? (
                <div className="space-y-4">
                  <div>
                    <label className="block mb-1 text-sm text-gray-600">Store Name</label>
                    <input
                      type="text"
                      value={storeForm.storeName}
                      onChange={(e) => setStoreForm({ ...storeForm, storeName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm text-gray-600">Street Address</label>
                    <input
                      type="text"
                      value={storeForm.storeLocation}
                      onChange={(e) => setStoreForm({ ...storeForm, storeLocation: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 text-sm text-gray-600">City</label>
                      <input
                        type="text"
                        value={storeForm.storeCity}
                        onChange={(e) => setStoreForm({ ...storeForm, storeCity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 text-sm text-gray-600">State</label>
                      <input
                        type="text"
                        value={storeForm.storeState}
                        onChange={(e) => setStoreForm({ ...storeForm, storeState: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxLength={2}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1 text-sm text-gray-600">ZIP Code</label>
                    <input
                      type="text"
                      value={storeForm.storeZip}
                      onChange={(e) => setStoreForm({ ...storeForm, storeZip: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm text-gray-600">Purchase Date</label>
                    <input
                      type="date"
                      value={formatDateForInput(storeForm.purchaseDate)}
                      onChange={(e) => setStoreForm({ ...storeForm, purchaseDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveStoreInfo}
                      disabled={saving}
                      className="px-4 py-2 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
                          purchaseDate: receipt.purchase_date || '',
                        });
                      }}
                      className="px-4 py-2 font-medium text-gray-700 transition-colors bg-gray-200 rounded-lg hover:bg-gray-300"
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
                  <div className="pt-3 space-y-2 border-t border-gray-200">
                    {/* Receipt Totals Header */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">Receipt Totals</h3>
                      {!editingTotal && (
                        <button
                          onClick={handleEditTotalClick}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {editingTotal ? (
                      // Edit Mode - subtotal calculated, tax editable
                      <div className="space-y-3">
                        {/* Subtotal - calculated from items */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Subtotal</span>
                          <span className="font-medium text-gray-700">
                            {formatCurrency(parseFloat(subtotalForm))}
                          </span>
                        </div>

                        {/* Editable Tax */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Tax</span>
                          <div className="relative w-28">
                            <span className="absolute text-sm text-gray-400 -translate-y-1/2 left-2 top-1/2">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={taxForm}
                              onChange={(e) => handleTaxChange(e.target.value)}
                              onBlur={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                handleTaxChange(value.toFixed(2));
                              }}
                              className="w-full border border-gray-300 rounded-lg pl-6 pr-2 py-1.5 text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>

                        {/* Total (auto-calculated) */}
                        <div className="pt-2 border-t border-gray-100">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-800">Total</span>
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
                            className="flex-1 px-3 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEditTotal}
                            disabled={saving}
                            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 transition-colors bg-gray-200 rounded-lg hover:bg-gray-300"
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
                          <span className="text-sm text-gray-500">Subtotal</span>
                          <span className="font-medium text-gray-700">
                            {formatCurrency(calculateSubtotal())}
                          </span>
                        </div>

                        {/* Tax - calculated as total minus subtotal */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Tax</span>
                          <span className="font-medium text-gray-700">
                            {formatCurrency(calculateTax())}
                          </span>
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <span className="font-semibold text-gray-800">Total</span>
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
            <div className="p-4 bg-white shadow-lg rounded-xl sm:p-6">
              <div className="flex flex-col items-start justify-between gap-2 mb-4 sm:flex-row sm:items-center">
                <h2 className="text-lg font-semibold text-gray-800">
                  Items ({receipt.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0})
                </h2>
                <div className="flex items-center gap-2">
                  <select
                    value={itemSortBy}
                    onChange={(e) => setItemSortBy(e.target.value as 'receipt' | 'totalPrice')}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="receipt">Receipt Order</option>
                    <option value="totalPrice">Total Price</option>
                  </select>
                  <button
                    onClick={() => setItemSortOrder(itemSortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-1 text-gray-600 rounded hover:text-blue-600 hover:bg-gray-100"
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
                <div className="mb-4 space-y-3 overflow-y-auto max-h-96">
                  {sortedItems.map((item) => (
                    <div
                      key={item.id}
                      draggable={itemSortBy === 'receipt'}
                      onDragStart={itemSortBy === 'receipt' ? (e) => handleDragStart(e, item.id) : undefined}
                      onDragOver={itemSortBy === 'receipt' ? (e) => handleDragOver(e, item.id) : undefined}
                      onDragLeave={itemSortBy === 'receipt' ? handleDragLeave : undefined}
                      onDrop={itemSortBy === 'receipt' ? (e) => handleDrop(e, item.id) : undefined}
                      onDragEnd={itemSortBy === 'receipt' ? handleDragEnd : undefined}
                      className={`p-3 rounded-lg bg-gray-50 transition-all ${
                        itemSortBy === 'receipt' ? 'cursor-move' : ''
                      } ${
                        draggedItemId === item.id ? 'opacity-50 scale-95' : ''
                      } ${
                        dragOverItemId === item.id ? 'border-2 border-blue-400 border-dashed' : ''
                      }`}
                    >
                      {editingItemId === item.id ? (
                        // Edit Mode
                        <div className="space-y-3">
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="block mb-1 text-xs text-gray-500">Product ID</label>
                              <input
                                type="text"
                                value={editItemForm.itemNumber}
                                onChange={(e) => setEditItemForm({ ...editItemForm, itemNumber: e.target.value })}
                                placeholder="Optional"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block mb-1 text-xs text-gray-500">Item Name</label>
                              <input
                                type="text"
                                value={editItemForm.name}
                                onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-8 gap-2">
                            <div className="col-span-2">
                              <label className="block mb-1 text-xs text-gray-500">Unit Price</label>
                              <div className="relative">
                                <span className="absolute text-xs text-gray-400 -translate-y-1/2 left-2 top-1/2">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editItemForm.unitPrice}
                                  onChange={(e) => setEditItemForm({ ...editItemForm, unitPrice: e.target.value })}
                                  onBlur={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    setEditItemForm({ ...editItemForm, unitPrice: value.toFixed(2) });
                                  }}
                                  className="w-full border border-gray-300 rounded-lg pl-5 pr-2 py-2 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                            <div className="col-span-1">
                              <label className="block mb-1 text-xs text-gray-500">Quantity</label>
                              <input
                                type="number"
                                min="1"
                                value={editItemForm.quantity}
                                onChange={(e) => setEditItemForm({ ...editItemForm, quantity: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block mb-1 text-xs text-gray-500">Discount</label>
                              <div className="relative">
                                <span className="absolute text-xs text-gray-400 -translate-y-1/2 left-2 top-1/2">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editItemForm.discount}
                                  onChange={(e) => setEditItemForm({ ...editItemForm, discount: e.target.value })}
                                  onBlur={(e) => {
                                    const value = parseFloat(e.target.value) || 0;
                                    setEditItemForm({ ...editItemForm, discount: value.toFixed(2) });
                                  }}
                                  className="w-full border border-gray-300 rounded-lg pl-5 pr-2 py-2 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                            <div className="col-span-3">
                              <label className="block mb-1 text-xs text-gray-500">Category</label>
                              <select
                                value={editItemForm.category}
                                onChange={(e) => setEditItemForm({ ...editItemForm, category: e.target.value })}
                                className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                              className="flex-1 px-3 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleEditItemCancel}
                              disabled={saving}
                              className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 transition-colors bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-start justify-between">
                          {itemSortBy === 'receipt' && (
                            <div className="mt-0.5 mr-2 text-gray-400 cursor-move hover:text-gray-600 shrink-0" title="Drag to reorder">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {item.item_number && (
                                <span className="font-mono text-xs text-gray-400">
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
                              className="p-1 text-gray-400 transition-colors hover:text-blue-600"
                              title="Edit item"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteItemClick(item)}
                              className="p-1 text-gray-400 transition-colors hover:text-red-600"
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
                <p className="mb-4 text-sm text-gray-500">
                  No items added yet. Add items to track purchases.
                </p>
              )}

              {/* Add Item Form */}
              {addingItem ? (
                <div className="pt-4 space-y-4 border-t border-gray-200">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block mb-1 text-sm text-gray-600">Product ID</label>
                      <input
                        type="text"
                        value={itemForm.itemNumber}
                        onChange={(e) => setItemForm({ ...itemForm, itemNumber: e.target.value })}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block mb-1 text-sm text-gray-600">Item Name</label>
                      <input
                        type="text"
                        value={itemForm.name}
                        onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                        placeholder="Enter item name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block mb-1 text-sm text-gray-600">Unit Price</label>
                      <div className="relative">
                        <span className="absolute text-sm text-gray-400 -translate-y-1/2 left-2 top-1/2">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={itemForm.unitPrice}
                          onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setItemForm({ ...itemForm, unitPrice: value.toFixed(2) });
                          }}
                          placeholder="0.00"
                          className="w-full border border-gray-300 rounded-lg pl-6 pr-3 py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-1 text-sm text-gray-600">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={itemForm.quantity}
                        onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block mb-1 text-sm text-gray-600">Discount</label>
                      <div className="relative">
                        <span className="absolute text-sm text-gray-400 -translate-y-1/2 left-2 top-1/2">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={itemForm.discount}
                          onChange={(e) => setItemForm({ ...itemForm, discount: e.target.value })}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setItemForm({ ...itemForm, discount: value.toFixed(2) });
                          }}
                          placeholder="0.00"
                          className="w-full border border-gray-300 rounded-lg pl-6 pr-3 py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1 text-sm text-gray-600">Category</label>
                    <select
                      value={itemForm.category}
                      onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="px-4 py-2 font-medium text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Item'}
                    </button>
                    <button
                      onClick={() => {
                        setAddingItem(false);
                        setItemForm({
                          itemNumber: '',
                          name: '',
                          unitPrice: '',
                          quantity: '1',
                          discount: '0',
                          category: 'Uncategorized',
                        });
                      }}
                      className="px-4 py-2 font-medium text-gray-700 transition-colors bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingItem(true)}
                  className="flex items-center justify-center w-full gap-2 py-3 font-medium text-gray-600 transition-colors border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 hover:text-gray-700"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-90 cursor-zoom-out"
          onClick={() => setImageZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed receipt image"
        >
          <img
            src={receipt.image_url.startsWith('data:') ? receipt.image_url : `${API_BASE_URL}${receipt.image_url}`}
            alt={`Zoomed receipt from ${receipt.store_name || 'Store'}`}
            className="object-contain max-w-full max-h-full"
          />
          <button
            className="absolute text-white top-4 right-4 hover:text-gray-300"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="delete-receipt-title">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            {/* Warning Icon */}
            <svg
              className="w-12 h-12 mx-auto mb-4 text-red-600"
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
            <h2 id="delete-receipt-title" className="mb-2 text-xl font-bold text-center text-gray-800">
              Delete Receipt?
            </h2>
            <p className="mb-4 text-center text-gray-600">
              Are you sure you want to delete this receipt? This action cannot
              be undone. All items will also be deleted.
            </p>

            {/* Receipt Preview */}
            <div className="p-3 mb-6 rounded-lg bg-gray-50">
              <p className="font-medium text-gray-800">
                {receipt.store_name || 'Store'}
              </p>
              <p className="text-sm text-gray-600">
                {formatDate(receipt.purchase_date)}
              </p>
              <p className="font-bold text-green-600">
                {formatCurrency(receipt.total_amount)}
              </p>
              {receipt.items && receipt.items.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
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
                className="flex-1 px-4 py-3 font-medium text-gray-700 transition-colors bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                autoFocus
                className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-medium text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="delete-item-title">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            {/* Warning Icon */}
            <svg
              className="w-12 h-12 mx-auto mb-4 text-red-600"
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
            <h2 id="delete-item-title" className="mb-2 text-xl font-bold text-center text-gray-800">
              Delete Item?
            </h2>
            <p className="mb-4 text-center text-gray-600">
              Are you sure you want to delete this item? This action cannot be undone.
            </p>

            {/* Item Preview */}
            <div className="p-3 mb-6 rounded-lg bg-gray-50">
              <p className="font-medium text-gray-800">{itemToDelete.name}</p>
              <p className="text-sm text-gray-600">
                {formatCurrency(itemToDelete.unit_price)} × {itemToDelete.quantity}
              </p>
              <p className="font-bold text-green-600">
                {formatCurrency(itemToDelete.total_price)}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleDeleteItemCancel}
                disabled={deletingItem}
                className="flex-1 px-4 py-3 font-medium text-gray-700 transition-colors bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItemConfirm}
                disabled={deletingItem}
                autoFocus
                className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-medium text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
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
