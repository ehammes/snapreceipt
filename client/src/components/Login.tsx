import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config/api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setError('Invalid email or password');
        } else {
          setError(data.error || 'Login failed');
        }
        setLoading(false);
        return;
      }

      // Store auth data
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.userId);

      // Navigate to receipts
      navigate('/receipts');
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-start justify-center min-h-screen px-4 pt-16 pb-12 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 -translate-y-1/2 bg-blue-100 rounded-full w-96 h-96 opacity-30 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 bg-indigo-100 rounded-full w-80 h-80 opacity-30 -translate-x-1/3" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="relative w-12 h-12">
            <svg
              className="absolute inset-0 w-12 h-12 text-blue-600"
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
              className="absolute inset-0 w-12 h-12 text-blue-500"
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
          <span className="text-2xl font-bold text-gray-800">SnapReceipt</span>
        </Link>

        {/* Login Card */}
        <div className="p-8 bg-white border border-gray-100 shadow-xl rounded-2xl">
          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Log in to your account</h1>
            {/* <p className="mt-2 text-gray-500">Log in to your account to continue</p> */}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-4 mb-6 text-sm text-red-700 border-l-4 border-red-500 rounded-r-lg bg-red-50">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
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
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="Enter your email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-gray-900 placeholder-gray-400 transition-all border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
              </div>
              <input
                id="password"
                type="password"
                required
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 text-gray-900 placeholder-gray-400 transition-all border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all ${
                loading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-[0.99]'
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
                  Logging in...
                </span>
              ) : (
                'Log in'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 text-gray-500 bg-white">or</span>
            </div>
          </div>

          {/* Sign Up Link */}
          <div className="text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        {/* <p className="mt-8 text-sm text-center text-gray-400">
          By logging in, you agree to our Terms of Service
        </p> */}
      </div>
    </div>
  );
};

export default Login;
