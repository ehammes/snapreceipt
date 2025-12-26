import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReceiptReviewModal, { ReviewData, ReviewItem } from './ReceiptReviewModal';

interface ProcessedItem {
  id?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  itemNumber?: string;
  item_order?: number;
  category?: string;
}

interface ProcessedReceipt {
  storeName: string;
  storeLocation: string;
  storeCity: string;
  storeState: string;
  storeZip: string;
  purchaseDate: string;
  totalAmount: number;
  items: ProcessedItem[];
  imageUrl: string;
}

const ReceiptUpload: React.FC = () => {
  const navigate = useNavigate();

  // State management
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [saving, setSaving] = useState(false);

  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Auth check on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  // Handle file selection
  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setShowReviewModal(false);
    setReviewData(null);
  };

  // Handle file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  // Convert processed data to review data format
  const convertToReviewData = (data: ProcessedReceipt): ReviewData => {
    return {
      storeName: data.storeName || 'Costco',
      storeLocation: data.storeLocation || '',
      storeCity: data.storeCity || '',
      storeState: data.storeState || '',
      storeZip: data.storeZip || '',
      purchaseDate: data.purchaseDate || new Date().toISOString(),
      totalAmount: data.totalAmount || 0,
      imageUrl: data.imageUrl || '',
      items: data.items.map((item, index) => ({
        id: item.id || `item-${index}-${Date.now()}`,
        itemNumber: item.itemNumber || '',
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        category: item.category || 'Groceries',
      })),
    };
  };

  // Handle upload and processing
  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProcessing(true);

    try {
      const formData = new FormData();
      formData.append('receipt', file);

      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Upload for processing only (don't save yet)
      const response = await fetch('http://localhost:3001/api/receipts/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        throw new Error(data.error || 'Failed to process receipt');
      }

      // For now, the server auto-saves on upload for authenticated users
      // We'll show the review modal with the saved data and allow editing
      // The receipt is already saved, so we'll redirect after any edits

      // Convert the response data to review format
      const processedData: ProcessedReceipt = {
        storeName: data.data?.store_name || data.data?.storeName || 'Costco',
        storeLocation: data.data?.store_location || data.data?.storeLocation || '',
        storeCity: data.data?.store_city || data.data?.storeCity || '',
        storeState: data.data?.store_state || data.data?.storeState || '',
        storeZip: data.data?.store_zip || data.data?.storeZip || '',
        purchaseDate: data.data?.purchase_date || data.data?.purchaseDate || new Date().toISOString(),
        totalAmount: data.data?.total_amount || data.data?.totalAmount || 0,
        imageUrl: data.data?.image_url || data.imageUrl || '',
        items: (data.data?.items || []).map((item: any) => ({
          id: item.id?.toString(),
          name: item.name,
          unitPrice: parseFloat(item.unit_price) || item.unitPrice || 0,
          quantity: item.quantity || 1,
          totalPrice: parseFloat(item.total_price) || item.totalPrice || 0,
          itemNumber: item.item_number || item.itemNumber || '',
          category: item.category || 'Groceries',
        })),
      };

      // Store the receipt ID for later use when saving edits
      const receiptId = data.receiptId;

      setReviewData({
        ...convertToReviewData(processedData),
        receiptId, // Add receipt ID to review data
      } as ReviewData & { receiptId: string });
      setShowReviewModal(true);

    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload receipt');
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  // Handle save from review modal
  const handleSaveReview = async (data: ReviewData) => {
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Get receipt ID from review data
      const receiptId = (data as ReviewData & { receiptId?: string }).receiptId;

      if (receiptId) {
        // Update existing receipt with edited data
        const response = await fetch(`http://localhost:3001/api/receipts/${receiptId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            storeName: data.storeName,
            storeLocation: data.storeLocation,
            storeCity: data.storeCity,
            storeState: data.storeState,
            storeZip: data.storeZip,
            purchaseDate: data.purchaseDate,
            totalAmount: data.totalAmount,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update receipt');
        }

        // Update each item (category and other edits)
        for (const item of data.items) {
          // Only update items that have a server ID (not newly added items with client IDs)
          if (item.id && !item.id.startsWith('new-') && !item.id.startsWith('item-')) {
            await fetch(`http://localhost:3001/api/receipts/${receiptId}/items/${item.id}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: item.name,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                totalPrice: item.totalPrice,
                category: item.category,
                itemNumber: item.itemNumber,
              }),
            });
          }
        }

        navigate(`/receipts/${receiptId}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert(error instanceof Error ? error.message : 'Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel from review modal
  const handleCancelReview = () => {
    // Get receipt ID to navigate to detail page (receipt is already saved)
    const receiptId = (reviewData as ReviewData & { receiptId?: string })?.receiptId;
    if (receiptId) {
      navigate(`/receipts/${receiptId}`);
    } else {
      setShowReviewModal(false);
      clearSelection();
    }
  };

  // Clear selection and reset state
  const clearSelection = () => {
    setFile(null);
    setPreviewUrl(null);
    setShowReviewModal(false);
    setReviewData(null);
    setUploading(false);
    setProcessing(false);

    // Clear file input values
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  // Render upload options (no file selected)
  const renderUploadOptions = () => (
    <div className="space-y-4">
      {/* Take Photo Button */}
      <button
        onClick={() => cameraInputRef.current?.click()}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-lg font-medium flex items-center justify-center gap-3 transition-colors"
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
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Take Photo
      </button>

      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gray-300"></div>
        <span className="text-gray-500 text-sm">or</span>
        <div className="flex-1 h-px bg-gray-300"></div>
      </div>

      {/* Choose from Gallery Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full border-2 border-dashed border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-700 py-4 px-6 rounded-lg font-medium flex items-center justify-center gap-3 transition-colors"
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
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Choose from Gallery
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Tip text */}
      <p className="text-center text-gray-500 text-sm mt-4">
        Ensure entire receipt is visible and well-lit
      </p>
    </div>
  );

  // Render preview and upload UI
  const renderPreview = () => (
    <div className="space-y-4">
      {/* Image Preview */}
      <div className="bg-gray-100 rounded-lg p-2">
        <img
          src={previewUrl!}
          alt="Receipt preview"
          className="max-h-96 w-full object-contain rounded"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={clearSelection}
          disabled={uploading}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Retake
        </button>
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {uploading ? 'Processing...' : 'Process Receipt'}
        </button>
      </div>
    </div>
  );

  // Render processing state
  const renderProcessing = () => (
    <div className="text-center py-12">
      {/* Spinning loader */}
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
      <p className="mt-4 text-lg font-medium text-gray-800">
        Processing receipt with AI...
      </p>
      <p className="mt-2 text-gray-500">
        Extracting items, prices, and store info
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Upload Receipt</h1>
            <p className="text-gray-600 mt-1">
              Take a photo or choose an image of your Costco receipt
            </p>
          </div>

          {/* Content based on state */}
          {processing ? (
            renderProcessing()
          ) : file && previewUrl ? (
            renderPreview()
          ) : (
            renderUploadOptions()
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && reviewData && (
        <ReceiptReviewModal
          data={reviewData}
          onSave={handleSaveReview}
          onCancel={handleCancelReview}
          saving={saving}
        />
      )}
    </div>
  );
};

export default ReceiptUpload;
