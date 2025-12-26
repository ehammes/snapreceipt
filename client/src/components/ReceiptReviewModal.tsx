import React, { useState } from 'react';
import { CATEGORIES } from '../constants/categories';

export interface ReviewItem {
  id: string;
  itemNumber: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  category: string;
}

export interface ReviewData {
  storeName: string;
  storeLocation: string;
  storeCity: string;
  storeState: string;
  storeZip: string;
  purchaseDate: string;
  totalAmount: number;
  items: ReviewItem[];
  imageUrl: string;
}

interface ReceiptReviewModalProps {
  data: ReviewData;
  onSave: (data: ReviewData) => void;
  onCancel: () => void;
  saving: boolean;
}

const ReceiptReviewModal: React.FC<ReceiptReviewModalProps> = ({
  data,
  onSave,
  onCancel,
  saving,
}) => {
  const [formData, setFormData] = useState<ReviewData>(data);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState<Omit<ReviewItem, 'id'>>({
    itemNumber: '',
    name: '',
    unitPrice: 0,
    quantity: 1,
    totalPrice: 0,
    category: 'Groceries',
  });

  // Generate unique ID for new items
  const generateId = () => `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Format date for input
  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  // Update store info
  const updateStoreInfo = (field: keyof ReviewData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Update item
  const updateItem = (itemId: string, field: keyof ReviewItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== itemId) return item;
        const updated = { ...item, [field]: value };
        // Recalculate total if unit price or quantity changes
        if (field === 'unitPrice' || field === 'quantity') {
          updated.totalPrice = Number(updated.unitPrice) * Number(updated.quantity);
        }
        return updated;
      }),
    }));
  };

  // Delete item
  const deleteItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId),
    }));
  };

  // Add new item
  const handleAddItem = () => {
    const itemToAdd: ReviewItem = {
      ...newItem,
      id: generateId(),
      totalPrice: newItem.unitPrice * newItem.quantity,
    };
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, itemToAdd],
    }));
    setNewItem({
      itemNumber: '',
      name: '',
      unitPrice: 0,
      quantity: 1,
      totalPrice: 0,
      category: 'Groceries',
    });
    setAddingItem(false);
  };

  // Calculate total from items
  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  // Format currency
  const formatCurrency = (amount: number) => `$${Number(amount).toFixed(2)}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 py-6 flex items-start justify-center">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Review Receipt</h2>
            <button
              onClick={onCancel}
              disabled={saving}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Store Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Store Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Store Name</label>
                  <input
                    type="text"
                    value={formData.storeName}
                    onChange={(e) => updateStoreInfo('storeName', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={formData.storeLocation}
                    onChange={(e) => updateStoreInfo('storeLocation', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.storeCity}
                    onChange={(e) => updateStoreInfo('storeCity', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.storeState}
                      onChange={(e) => updateStoreInfo('storeState', e.target.value)}
                      maxLength={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">ZIP</label>
                    <input
                      type="text"
                      value={formData.storeZip}
                      onChange={(e) => updateStoreInfo('storeZip', e.target.value)}
                      maxLength={10}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Details */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-4">Purchase Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formatDateForInput(formData.purchaseDate)}
                    onChange={(e) => updateStoreInfo('purchaseDate', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Total Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.totalAmount}
                      onChange={(e) => updateStoreInfo('totalAmount', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Items total: {formatCurrency(calculateTotal())}
                  </p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">
                  Items ({formData.items.reduce((sum, item) => sum + (item.quantity || 1), 0)})
                </h3>
              </div>

              {/* Items List */}
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {formData.items.map((item) => (
                  <div key={item.id} className="bg-white rounded-lg p-3 border border-gray-200">
                    {editingItemId === item.id ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Product ID</label>
                            <input
                              type="text"
                              value={item.itemNumber}
                              onChange={(e) => updateItem(item.id, 'itemNumber', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-3">
                            <label className="block text-xs text-gray-500 mb-1">Name</label>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Unit Price</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Category</label>
                            <select
                              value={item.category}
                              onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => setEditingItemId(null)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.itemNumber && (
                              <span className="text-xs text-gray-400 font-mono">{item.itemNumber}</span>
                            )}
                            <span className="font-medium text-gray-800 truncate">{item.name}</span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {formatCurrency(item.unitPrice)} × {item.quantity} = {formatCurrency(item.totalPrice)}
                          </p>
                          {item.category && (
                            <span className="text-xs text-blue-600">{item.category}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingItemId(item.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit item"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
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

                {formData.items.length === 0 && !addingItem && (
                  <p className="text-gray-500 text-sm text-center py-4">No items extracted</p>
                )}
              </div>

              {/* Add Item Form */}
              {addingItem ? (
                <div className="mt-4 bg-white rounded-lg p-3 border-2 border-dashed border-blue-300">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Item</h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Product ID</label>
                        <input
                          type="text"
                          value={newItem.itemNumber}
                          onChange={(e) => setNewItem(prev => ({ ...prev, itemNumber: e.target.value }))}
                          placeholder="Optional"
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-3">
                        <label className="block text-xs text-gray-500 mb-1">Name *</label>
                        <input
                          type="text"
                          value={newItem.name}
                          onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Item name"
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Unit Price *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={newItem.unitPrice || ''}
                          onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                          placeholder="0.00"
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Category</label>
                        <select
                          value={newItem.category}
                          onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setAddingItem(false)}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddItem}
                        disabled={!newItem.name || !newItem.unitPrice}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add Item
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingItem(true)}
                  className="mt-4 w-full border-2 border-dashed border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-700 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Item
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              onClick={onCancel}
              disabled={saving}
              className="flex-1 sm:flex-none px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(formData)}
              disabled={saving}
              className="flex-1 sm:flex-none px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Receipt'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptReviewModal;
