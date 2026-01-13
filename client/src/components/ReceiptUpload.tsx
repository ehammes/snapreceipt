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

type ErrorType = 'ocr' | 'network' | 'auth' | 'server' | null;

interface UploadError {
  type: ErrorType;
  message: string;
  canRetry: boolean;
}

const ReceiptUpload: React.FC = () => {
  const navigate = useNavigate();

  // State management
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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
    setUploadError(null);
    setRetryCount(0);
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
        discount: 0,
        totalPrice: item.totalPrice,
        category: item.category || 'Groceries',
      })),
    };
  };

  // Compress image before upload
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions (max 2000px on longest side)
          const maxDimension = 2000;
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height * maxDimension) / width;
              width = maxDimension;
            } else {
              width = (width * maxDimension) / height;
              height = maxDimension;
            }
          }

          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to blob with compression (0.85 quality for JPEG)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Image compression failed'));
              }
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // Clear error state
  const clearError = () => {
    setUploadError(null);
    setRetryCount(0);
  };

  // Handle upload and processing
  const handleUpload = async (isRetry = false) => {
    if (!file) return;

    if (!isRetry) {
      setRetryCount(0);
    }
    setUploadError(null);
    setUploading(true);
    setProcessing(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUploadError({
          type: 'auth',
          message: 'Your session has expired. Please log in again to continue.',
          canRetry: false,
        });
        setUploading(false);
        setProcessing(false);
        return;
      }

      // Compress image if needed
      let fileToUpload = file;
      const maxSizeBytes = 5 * 1024 * 1024; // 5 MB threshold for compression

      if (file.size > maxSizeBytes) {
        setCompressing(true);
        try {
          fileToUpload = await compressImage(file);
        } catch (compressionError) {
          console.error('Image compression failed:', compressionError);
          setUploadError({
            type: 'server',
            message: 'Failed to compress image. Please try a different image.',
            canRetry: false,
          });
          setUploading(false);
          setCompressing(false);
          setProcessing(false);
          return;
        } finally {
          setCompressing(false);
        }
      }

      // Convert file to base64
      const base64Image = await fileToBase64(fileToUpload);

      // Verify the final size isn't too large
      const finalSizeBytes = base64Image.length;
      const maxFinalSize = 10 * 1024 * 1024; // 10 MB final limit

      if (finalSizeBytes > maxFinalSize) {
        setUploadError({
          type: 'server',
          message: 'Image is too large even after compression. Please try a smaller image.',
          canRetry: false,
        });
        setUploading(false);
        setProcessing(false);
        return;
      }

      // Upload for processing with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/api/receipts/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: base64Image, imageUrl: '' }),
          signal: controller.signal,
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        // Network or timeout error
        if (fetchError.name === 'AbortError') {
          setUploadError({
            type: 'network',
            message: 'Processing is taking too long. Please try again with a clearer image.',
            canRetry: true,
          });
        } else {
          setUploadError({
            type: 'network',
            message: 'Unable to connect. Please check your internet connection and try again.',
            canRetry: true,
          });
        }
        return;
      }
      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          setUploadError({
            type: 'auth',
            message: 'Your session has expired. Please log in again to continue.',
            canRetry: false,
          });
          return;
        }
        if (response.status === 413) {
          setUploadError({
            type: 'server',
            message: 'Image file is too large. Please try a smaller image or compress it.',
            canRetry: false,
          });
          return;
        }
        if (response.status >= 500) {
          setUploadError({
            type: 'server',
            message: 'Our servers are having trouble. Please try again in a moment.',
            canRetry: true,
          });
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to process receipt');
      }

      // Parse JSON response with error handling
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        setUploadError({
          type: 'server',
          message: 'Received an invalid response from the server. Please try again.',
          canRetry: true,
        });
        return;
      }

      // Check for OCR failure (empty or poor results)
      const items = data.data?.items || [];
      const storeName = data.data?.store_name || data.data?.storeName || '';
      const totalAmount = data.data?.total_amount || data.data?.totalAmount || 0;

      const isOcrPoor = items.length === 0 && !storeName && totalAmount === 0;

      // Convert the response data to review format
      const processedData: ProcessedReceipt = {
        storeName: data.data?.store_name || data.data?.storeName || '',
        storeLocation: data.data?.store_location || data.data?.storeLocation || '',
        storeCity: data.data?.store_city || data.data?.storeCity || '',
        storeState: data.data?.store_state || data.data?.storeState || '',
        storeZip: data.data?.store_zip || data.data?.storeZip || '',
        purchaseDate: data.data?.purchase_date || data.data?.purchaseDate || new Date().toISOString(),
        totalAmount: totalAmount,
        imageUrl: data.data?.image_url || data.imageUrl || '',
        items: items.map((item: any) => ({
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

      // If OCR results are poor, show warning but still allow manual entry
      if (isOcrPoor) {
        setUploadError({
          type: 'ocr',
          message: "We couldn't read this receipt clearly. You can still enter the details manually below.",
          canRetry: true,
        });
      }

      setReviewData({
        ...convertToReviewData(processedData),
        receiptId,
      } as ReviewData & { receiptId: string });
      setShowReviewModal(true);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError({
        type: 'server',
        message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        canRetry: true,
      });
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  // Handle retry
  const handleRetry = () => {
    if (retryCount < 2) {
      setRetryCount(prev => prev + 1);
      handleUpload(true);
    } else {
      setUploadError({
        type: uploadError?.type || 'server',
        message: 'Multiple attempts failed. Please try a different image or try again later.',
        canRetry: false,
      });
    }
  };

  // Handle login redirect
  const handleLoginRedirect = () => {
    // Store the current file in sessionStorage before redirecting
    if (previewUrl) {
      sessionStorage.setItem('pendingReceiptImage', previewUrl);
    }
    navigate('/login');
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
            await fetch(`${API_BASE_URL}/api/items/${item.id}?receiptId=${receiptId}`, {
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
    setCompressing(false);
    setProcessing(false);
    setUploadError(null);
    setRetryCount(0);

    // Clear file input values
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  // Render error alert
  const renderErrorAlert = () => {
    if (!uploadError) return null;

    const isWarning = uploadError.type === 'ocr';
    const bgColor = isWarning ? 'bg-amber-50' : 'bg-red-50';
    const borderColor = isWarning ? 'border-amber-200' : 'border-red-200';
    const textColor = isWarning ? 'text-amber-800' : 'text-red-800';
    const iconColor = isWarning ? 'text-amber-500' : 'text-red-500';
    const closeButtonColor = isWarning
      ? 'text-amber-400 hover:text-amber-600'
      : 'text-red-400 hover:text-red-600';

    return (
      <div className={`${bgColor} ${borderColor} border rounded-xl p-4 mb-4 relative`}>
        <div className="flex items-start gap-3 pr-8">
          {/* Icon */}
          <div className={`flex-shrink-0 ${iconColor}`}>
            {isWarning ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          {/* Message and actions */}
          <div className="flex-1">
            <p className={`text-sm font-medium ${textColor}`}>
              {uploadError.message}
            </p>

            {/* Action buttons */}
            {(uploadError.type === 'auth' || (uploadError.canRetry && retryCount < 2)) && (
              <div className="mt-3 flex gap-2">
                {uploadError.type === 'auth' ? (
                  <button
                    onClick={handleLoginRedirect}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Log In
                  </button>
                ) : uploadError.canRetry && retryCount < 2 ? (
                  <button
                    onClick={handleRetry}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again {retryCount > 0 && `(${2 - retryCount} left)`}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Close button (top-right corner) */}
        <button
          onClick={clearError}
          className={`absolute top-3 right-3 ${closeButtonColor} transition-colors p-1 rounded-lg hover:bg-white/50`}
          aria-label="Dismiss error"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
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
      {/* Error Alert */}
      {renderErrorAlert()}

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
          onClick={() => handleUpload()}
          disabled={uploading}
          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-6 rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          {compressing ? 'Compressing...' : uploading ? 'Processing...' : 'Process Receipt'}
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
        {compressing ? 'Compressing your image' : 'Processing your receipt'}
      </h2>
      <p className="text-gray-500 mb-8">
        {compressing
          ? 'Optimizing image size for faster upload...'
          : 'Our AI is extracting items, prices, and store information'}
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
