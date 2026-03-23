import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { API_ENDPOINTS } from '../config/api';

const MagicLink: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const verifiedRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invocation
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    const token = searchParams.get('token');

    if (!token) {
      setError('No login token found in this link.');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`${API_ENDPOINTS.MAGIC_LINK}?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Link is invalid or has expired.');
          return;
        }

        // Store auth and redirect — matches existing login pattern
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        window.dispatchEvent(new Event('authChange'));
        navigate('/receipts');
      } catch {
        setError('Something went wrong. Please try again.');
      }
    };

    verify();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Link expired or invalid</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <Link
              to="/forgot-password"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              Request a new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="text-center">
        <svg className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-gray-600 font-medium">Verifying your link...</p>
      </div>
    </div>
  );
};

export default MagicLink;
