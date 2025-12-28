import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ReceiptReviewModal, { ReviewData } from './ReceiptReviewModal';
import { API_BASE_URL } from '../config/api';

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
  const [isDragging, setIsDragging] = useState(false);

  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

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

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      handleFileSelect(droppedFile);
    }
  };

  // Convert processed data to review data format
  const convertToReviewData = (data: ProcessedReceipt): ReviewData => {
    return {
      storeName: data.storeName || '',
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
      const response = await fetch(`${API_BASE_URL}/api/receipts/upload`, {
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

      // Convert the response data to review format
      const processedData: ProcessedReceipt = {
        storeName: data.data?.store_name || data.data?.storeName || '',
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
        receiptId,
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
        const response = await fetch(`${API_BASE_URL}/api/receipts/${receiptId}`, {
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
            await fetch(`${API_BASE_URL}/api/receipts/${receiptId}/items/${item.id}`, {
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

  // Handle cancel from review modal - delete receipt and reset
  const handleCancelReview = async () => {
    const receiptId = (reviewData as ReviewData & { receiptId?: string })?.receiptId;

    // If receipt was already created, delete it
    if (receiptId) {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          await fetch(`${API_BASE_URL}/api/receipts/${receiptId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        }
      } catch (error) {
        console.error('Error deleting cancelled receipt:', error);
      }
    }

    // Reset all state
    setShowReviewModal(false);
    clearSelection();
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
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label="Drop zone for receipt images, click or press Enter to browse files"
      >
        <div className="flex flex-col items-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isDragging ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            <svg
              className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="text-gray-700 font-medium mb-1">
            Drag and drop your receipt here
          </p>
          <p className="text-gray-500 text-sm">
            or click to browse files
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Select receipt image file"
      />

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gray-200"></div>
        <span className="text-gray-400 text-sm font-medium">or use camera</span>
        <div className="flex-1 h-px bg-gray-200"></div>
      </div>

      {/* Take Photo Button */}
      <button
        onClick={() => cameraInputRef.current?.click()}
        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-4 px-6 rounded-xl font-medium flex items-center justify-center gap-3 transition-all shadow-md hover:shadow-lg"
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

      {/* Tips Section */}
      <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Tips for best results
        </h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-sm text-blue-800">
            <svg className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Ensure entire receipt is visible in the frame
          </li>
          <li className="flex items-start gap-2 text-sm text-blue-800">
            <svg className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Use good lighting to avoid shadows
          </li>
          <li className="flex items-start gap-2 text-sm text-blue-800">
            <svg className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Place receipt on a flat, contrasting surface
          </li>
        </ul>
      </div>

      {/* Quick Link */}
      <div className="text-center pt-2">
        <Link
          to="/receipts"
          className="text-sm text-gray-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          View your existing receipts
        </Link>
      </div>
    </div>
  );

  // Render preview and upload UI
  const renderPreview = () => (
    <div className="space-y-4">
      {/* Image Preview */}
      <div className="relative bg-gray-900 rounded-xl overflow-hidden">
        <img
          src={previewUrl!}
          alt="Receipt preview"
          className="max-h-[400px] w-full object-contain"
        />
        {/* Overlay with file info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <p className="text-white text-sm truncate">{file?.name}</p>
          <p className="text-white/70 text-xs">
            {file ? (file.size / 1024 / 1024).toFixed(2) : 0} MB
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={clearSelection}
          disabled={uploading}
          className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-3 px-6 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Choose Different
        </button>
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-6 rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          {uploading ? 'Processing...' : 'Process Receipt'}
        </button>
      </div>
    </div>
  );

  // Render processing state
  const renderProcessing = () => (
    <div className="text-center py-16">
      {/* Animated receipt icon */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25"></div>
        <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-white"
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
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-2">
        Processing your receipt
      </h2>
      <p className="text-gray-500 mb-8">
        Our AI is extracting items, prices, and store information
      </p>

      {/* Progress steps */}
      <div className="max-w-xs mx-auto space-y-3">
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-sm text-gray-600">Image uploaded</span>
        </div>
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <span className="text-sm text-gray-900 font-medium">Analyzing with AI...</span>
        </div>
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-sm text-gray-400">3</span>
          </div>
          <span className="text-sm text-gray-400">Review extracted data</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header Card */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Upload Receipt</h1>
              <p className="text-blue-100">
                Take a photo or upload an image to get started
              </p>
            </div>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-b-2xl shadow-lg p-6">
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
