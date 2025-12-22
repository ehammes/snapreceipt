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
        {/* Back Button */}
        <button
          onClick={() => navigate('/receipts')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors"
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
                      className="flex justify-between items-start bg-gray-50 rounded-lg p-3"
                    >
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
                      <span className="font-semibold text-green-600">
                        {formatCurrency(item.total_price)}
                      </span>
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
    </div>
  );
};

export default ReceiptDetail;
