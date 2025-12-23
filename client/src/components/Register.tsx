import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface GuestReceiptData {
  imageUrl: string;
  storeName: string;
  storeLocation: string;
  storeCity: string;
  storeState: string;
  storeZip: string;
  purchaseDate: string;
  totalAmount: number;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category?: string;
  }>;
}

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestData, setGuestData] = useState<GuestReceiptData | null>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const savedGuestReceipt = sessionStorage.getItem('guestReceipt');
    if (savedGuestReceipt) {
      try {
        const parsed = JSON.parse(savedGuestReceipt);
        setGuestData(parsed);
      } catch {
        console.error('Failed to parse guest receipt data');
      }
    }
  }, []);

  const validateEmail = (email: string): boolean => {
    return email.includes('@') && email.includes('.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Register the user
      const registerRes = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        if (registerRes.status === 409) {
          setError('Email already registered. Please login instead.');
        } else {
          setError(registerData.error || 'Registration failed');
        }
        setLoading(false);
        return;
      }

      // Store auth data
      localStorage.setItem('token', registerData.token);
      localStorage.setItem('userId', registerData.userId);

      // If we have guest receipt data, save it to the user's account
      if (guestData) {
        try {
          const saveRes = await fetch('http://localhost:3001/api/receipts/save-guest', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${registerData.token}`,
            },
            body: JSON.stringify({ guestReceiptData: guestData }),
          });

          if (saveRes.ok) {
            sessionStorage.removeItem('guestReceipt');
            setSuccess('Account created! Your receipt has been saved.');
            setTimeout(() => navigate('/receipts'), 1500);
          } else {
            // Account created but receipt save failed
            sessionStorage.removeItem('guestReceipt');
            setSuccess('Account created! (Receipt save failed - please re-upload)');
            setTimeout(() => navigate('/receipts'), 1500);
          }
        } catch {
          sessionStorage.removeItem('guestReceipt');
          navigate('/receipts');
        }
      } else {
        navigate('/receipts');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Guest Receipt Banner */}
        {guestData && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-blue-900">
                  Create an account to save your uploaded receipt!
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    <span className="font-medium">Store:</span>{' '}
                    {guestData.storeName || 'Costco'}
                  </p>
                  <p>
                    <span className="font-medium">Total:</span> $
                    {guestData.totalAmount?.toFixed(2) || '0.00'}
                  </p>
                  <p>
                    <span className="font-medium">Items:</span>{' '}
                    {guestData.items?.length || 0} items detected
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Registration Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Logo/Brand */}
          <div className="text-center mb-6">
            <svg
              className="w-12 h-12 mx-auto text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h1 className="text-2xl font-bold text-gray-800 mt-4">
              Create Your Account
            </h1>
            <p className="text-gray-600 mt-1">
              Track your Costco receipts and spending
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="your@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              {password.length > 0 && password.length < 8 && (
                <p className="text-red-600 text-sm mt-1">
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                placeholder="Confirm password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-red-600 text-sm mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${
                loading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
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
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-blue-600 hover:underline font-medium"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
