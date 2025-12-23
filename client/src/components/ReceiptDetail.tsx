import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
  category: string;
}

const CATEGORIES = [
  'Groceries',
  'Electronics',
  'Household',
  'Clothing',
  'Health',
  'Other',
];

const ReceiptDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [imageZoomed, setImageZoomed] = useState(false);
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
    category: 'Groceries',
  });

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Item edit/delete state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState<ItemForm>({
    name: '',
    unitPrice: '',
    quantity: '1',
    category: '',
  });
  const [deleteItemModalOpen, setDeleteItemModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ReceiptItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  useEffect(() => {
    if (id) {
      fetchReceipt();
    }
  }, [id]);

  const fetchReceipt = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`http://localhost:3001/api/receipts/${id}`, {
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
  };

  const handleSaveStoreInfo = async () => {
    if (!receipt) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/receipts/${id}`, {
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
      const response = await fetch(`http://localhost:3001/api/receipts/${id}/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: itemForm.name,
          unitPrice: parseFloat(itemForm.unitPrice),
          quantity: parseInt(itemForm.quantity) || 1,
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
        `http://localhost:3001/api/receipts/${receipt.id}`,
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
      category: item.category || 'Groceries',
    });
  };

  const handleEditItemCancel = () => {
    setEditingItemId(null);
    setEditItemForm({
      name: '',
      unitPrice: '',
      quantity: '1',
      category: '',
    });
  };

  const handleEditItemSave = async () => {
    if (!receipt || !editingItemId || !editItemForm.name || !editItemForm.unitPrice) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3001/api/receipts/${id}/items/${editingItemId}`,
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
        `http://localhost:3001/api/receipts/${id}/items/${itemToDelete.id}`,
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
        {/* Header with Back and Delete buttons */}
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

          <button
            onClick={handleDeleteClick}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium transition-colors"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete Receipt
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Receipt Image */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h2 className="font-semibold text-lg text-gray-800 mb-4">Receipt Image</h2>
            <div className="relative">
              {receipt.image_url ? (
                <>
                  <img
                    src={`http://localhost:3001${receipt.image_url}`}
                    alt="Receipt"
                    className="w-full rounded-lg cursor-zoom-in"
                    onClick={() => setImageZoomed(true)}
                  />
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Click to zoom
                  </p>
                </>
              ) : (
                <div className="aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-400">No image available</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
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
                    {receipt.store_name || 'Costco'}
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
                  <p className="text-2xl font-bold text-green-600 pt-2">
                    {formatCurrency(receipt.total_amount)}
                  </p>
                </div>
              )}
            </div>

            {/* Items List Card */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-lg text-gray-800">
                  Items ({receipt.items?.length || 0})
                </h2>
              </div>

              {/* Items List */}
              {receipt.items && receipt.items.length > 0 ? (
                <div className="max-h-96 overflow-y-auto space-y-3 mb-4">
                  {receipt.items.map((item) => (
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
                          <div className="grid grid-cols-3 gap-2">
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
                            <p className="font-medium text-gray-800">{item.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatCurrency(item.unit_price)} × {item.quantity} = {formatCurrency(item.total_price)}
                            </p>
                            {item.category && (
                              <span className="text-xs text-blue-600 mt-1 inline-block">
                                {item.category}
                              </span>
                            )}
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
                  <div className="grid grid-cols-2 gap-4">
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
        >
          <img
            src={`http://localhost:3001${receipt.image_url}`}
            alt="Receipt (zoomed)"
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
                {receipt.store_name || 'Costco'}
              </p>
              <p className="text-sm text-gray-600">
                {formatDate(receipt.purchase_date)}
              </p>
              <p className="text-green-600 font-bold">
                {formatCurrency(receipt.total_amount)}
              </p>
              {receipt.items && receipt.items.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {receipt.items.length} item
                  {receipt.items.length !== 1 ? 's' : ''}
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
