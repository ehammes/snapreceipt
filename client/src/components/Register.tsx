import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    return email.includes('@') && email.includes('.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
      const registerRes = await fetch(`${API_BASE_URL}/api/auth/register`, {
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

      // Navigate to receipts page
      navigate('/receipts');
    } catch (err) {
      console.error('Registration error:', err);
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Form */}
      <div className="flex items-center justify-center flex-1 p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="relative w-10 h-10">
              <svg
                className="absolute inset-0 w-10 h-10 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 36 36"
              >
                <path strokeLinecap="round" strokeWidth={2.5} d="M4 12V6a2 2 0 012-2h6" />
                <path strokeLinecap="round" strokeWidth={2.5} d="M24 4h6a2 2 0 012 2v6" />
                <path strokeLinecap="round" strokeWidth={2.5} d="M4 24v6a2 2 0 002 2h6" />
                <path strokeLinecap="round" strokeWidth={2.5} d="M32 24v6a2 2 0 01-2 2h-6" />
              </svg>
              <svg
                className="absolute inset-0 w-10 h-10 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 36 36"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9h12v18l-3-2-3 2-3-2-3 2V9z"
                />
                <path strokeLinecap="round" strokeWidth={1.5} d="M14 14h8M14 18h6" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-800">SnapReceipt</span>
          </Link>

          {/* Heading */}
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Create your free account
          </h1>
          <p className="mb-8 text-gray-500">
            Start tracking your receipts in seconds
          </p>

          {/* Error Message */}
          {error && (
            <div className="p-4 mb-6 text-sm text-red-700 border-l-4 border-red-500 rounded-r-lg bg-red-50">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block mb-2 text-sm font-medium text-gray-700"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="name@company.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-gray-900 placeholder-gray-400 transition-colors border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block mb-2 text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 text-gray-900 placeholder-gray-400 transition-colors border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {password.length > 0 && password.length < 8 && (
                <p className="flex items-center gap-1 mt-2 text-sm text-red-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block mb-2 text-sm font-medium text-gray-700"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                placeholder="Confirm your password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 text-gray-900 placeholder-gray-400 transition-colors border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="flex items-center gap-1 mt-2 text-sm text-red-600">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-lg font-semibold text-white transition-all ${
                loading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
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
                  Creating account...
                </span>
              ) : (
                'Get Started'
              )}
            </button>
          </form>

          {/* Footer Links */}
          <p className="mt-8 text-sm text-center text-gray-500">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Illustration */}
      <div className="relative items-center justify-center flex-1 hidden p-12 overflow-hidden lg:flex bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full w-72 h-72 bg-white/10" />
        <div className="absolute bottom-0 right-0 rounded-full w-96 h-96 bg-white/10 translate-x-1/3 translate-y-1/3" />
        <div className="absolute w-32 h-32 rounded-full top-1/2 left-1/4 bg-white/5" />

        {/* Content */}
        <div className="relative z-10 max-w-lg text-center text-white">
          {/* Illustration */}
          <div className="mb-8">
            <svg className="w-64 h-64 mx-auto" viewBox="0 0 200 200" fill="none">
              {/* Receipt stack illustration */}
              <rect x="40" y="60" width="80" height="100" rx="4" fill="white" fillOpacity="0.9" />
              <rect x="50" y="70" width="60" height="4" rx="2" fill="#3B82F6" fillOpacity="0.6" />
              <rect x="50" y="80" width="40" height="3" rx="1.5" fill="#94A3B8" />
              <rect x="50" y="88" width="50" height="3" rx="1.5" fill="#94A3B8" />
              <rect x="50" y="96" width="35" height="3" rx="1.5" fill="#94A3B8" />
              <rect x="50" y="110" width="60" height="4" rx="2" fill="#3B82F6" fillOpacity="0.4" />
              <rect x="50" y="120" width="45" height="3" rx="1.5" fill="#94A3B8" />
              <rect x="50" y="128" width="55" height="3" rx="1.5" fill="#94A3B8" />
              <rect x="50" y="142" width="60" height="6" rx="3" fill="#10B981" />

              {/* Second receipt (behind) */}
              <rect x="55" y="55" width="80" height="100" rx="4" fill="white" fillOpacity="0.5" transform="rotate(5 95 105)" />

              {/* Camera viewfinder */}
              <path d="M130 40 L150 40 A10 10 0 0 1 160 50 L160 70" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M160 130 L160 150 A10 10 0 0 1 150 160 L130 160" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M70 160 L50 160 A10 10 0 0 1 40 150 L40 130" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M40 70 L40 50 A10 10 0 0 1 50 40 L70 40" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />

              {/* Floating elements */}
              <circle cx="165" cy="85" r="12" fill="#10B981" />
              <path d="M160 85 L163 88 L170 81" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

              <circle cx="35" cy="100" r="8" fill="#F59E0B" />
              <text x="35" y="104" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">$</text>
            </svg>
          </div>

          <h2 className="mb-4 text-3xl font-bold">
            Track every receipt,<br />effortlessly
          </h2>
          <p className="text-lg text-blue-100">
            Snap photos, extract data automatically, and gain insights into your spending patterns.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <span className="px-4 py-2 text-sm font-medium rounded-full bg-white/20 backdrop-blur-sm">
              Auto Text Extraction
            </span>
            <span className="px-4 py-2 text-sm font-medium rounded-full bg-white/20 backdrop-blur-sm">
              Spending Analytics
            </span>
            <span className="px-4 py-2 text-sm font-medium rounded-full bg-white/20 backdrop-blur-sm">
              Search & Filter Receipts
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
