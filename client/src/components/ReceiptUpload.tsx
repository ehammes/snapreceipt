import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface ProcessedItem {
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
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
  const [processedData, setProcessedData] = useState<ProcessedReceipt | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setProcessedData(null);
    setIsGuest(false);
  };

  // Handle file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
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
      const headers: HeadersInit = {};

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('http://localhost:3001/api/receipts/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process receipt');
      }

      if (data.guestMode) {
        // Guest mode - show processed data and save to sessionStorage
        setIsGuest(true);
        setProcessedData(data.data);

        // Save guest receipt data to sessionStorage for account creation
        const guestReceiptData = {
          imageUrl: data.data.imageUrl,
          storeName: data.data.storeName,
          storeLocation: data.data.storeLocation,
          storeCity: data.data.storeCity,
          storeState: data.data.storeState,
          storeZip: data.data.storeZip,
          purchaseDate: data.data.purchaseDate,
          totalAmount: data.data.totalAmount,
          items: data.data.items,
        };
        sessionStorage.setItem('guestReceipt', JSON.stringify(guestReceiptData));
      } else {
        // Authenticated - redirect to receipt detail
        navigate(`/receipts/${data.receiptId}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload receipt');
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  // Clear selection and reset state
  const clearSelection = () => {
    setFile(null);
    setPreviewUrl(null);
    setProcessedData(null);
    setIsGuest(false);
    setUploading(false);
    setProcessing(false);

    // Clear guest receipt from sessionStorage
    sessionStorage.removeItem('guestReceipt');

    // Clear file input values
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
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

  // Render guest results
  const renderGuestResults = () => (
    <div className="space-y-6">
      {/* Success Banner */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
        <svg
          className="w-6 h-6 text-green-600 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <div>
          <p className="font-medium text-green-800">
            Receipt Processed Successfully!
          </p>
          <p className="text-green-700 text-sm">
            We've extracted {processedData?.items.length || 0} items from your receipt
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Receipt Image */}
        <div>
          <h3 className="font-medium text-gray-800 mb-3">Receipt Image</h3>
          <div className="bg-gray-100 rounded-lg p-2">
            <img
              src={previewUrl!}
              alt="Receipt"
              className="w-full rounded"
            />
          </div>
        </div>

        {/* Right Column - Extracted Data */}
        <div className="space-y-4">
          {/* Store Information Card */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-3">Store Information</h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-500">Store:</span>{' '}
                <span className="font-medium">{processedData?.storeName}</span>
              </p>
              {processedData?.storeLocation && (
                <p>
                  <span className="text-gray-500">Location:</span>{' '}
                  <span className="font-medium">
                    {processedData.storeLocation}
                    {processedData.storeCity && `, ${processedData.storeCity}`}
                    {processedData.storeState && `, ${processedData.storeState}`}
                    {processedData.storeZip && ` ${processedData.storeZip}`}
                  </span>
                </p>
              )}
              <p>
                <span className="text-gray-500">Date:</span>{' '}
                <span className="font-medium">
                  {processedData?.purchaseDate
                    ? formatDate(processedData.purchaseDate)
                    : 'Not detected'}
                </span>
              </p>
              <p className="pt-2 border-t border-gray-200">
                <span className="text-gray-500">Total:</span>{' '}
                <span className="font-bold text-green-600 text-lg">
                  {formatCurrency(processedData?.totalAmount || 0)}
                </span>
              </p>
            </div>
          </div>

          {/* Items List Card */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-3">
              Items ({processedData?.items.length || 0})
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {processedData?.items.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-start py-2 border-b border-gray-200 last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <span className="font-medium text-green-600">
                    {formatCurrency(item.totalPrice)}
                  </span>
                </div>
              ))}
              {(!processedData?.items || processedData.items.length === 0) && (
                <p className="text-gray-500 text-sm">No items detected</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Call-to-Action Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-medium text-blue-800 text-lg mb-2">
          Save Your Receipt!
        </h3>
        <p className="text-blue-700 mb-4">
          Create a free account to save and track your spending over time.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/register')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
          >
            Create Account
          </button>
          <button
            onClick={clearSelection}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium transition-colors"
          >
            Upload Another
          </button>
        </div>
      </div>
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
          ) : processedData && isGuest ? (
            renderGuestResults()
          ) : file && previewUrl ? (
            renderPreview()
          ) : (
            renderUploadOptions()
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptUpload;
