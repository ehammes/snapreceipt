import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check auth status on mount and when location changes
    setIsAuthenticated(!!localStorage.getItem('token'));
  }, [location]);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    sessionStorage.removeItem('guestReceipt');
    setIsAuthenticated(false);
    setMobileMenuOpen(false);
    // Dispatch custom event to notify other components of auth change
    window.dispatchEvent(new Event('authChange'));
    navigate('/');
  };

  const navLinks = [
    { path: '/upload', label: 'Upload' },
    { path: '/receipts', label: 'Receipts' },
    { path: '/dashboard', label: 'Analytics' },
  ];

  return (
    <nav className="bg-white shadow-md sticky top-0 z-40" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2" aria-label="SnapReceipt Home">
            <div className="relative w-9 h-9">
              {/* Camera viewfinder corners */}
              <svg
                className="absolute inset-0 w-9 h-9 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 36 36"
                aria-hidden="true"
              >
                {/* Top-left corner */}
                <path strokeLinecap="round" strokeWidth={2.5} d="M4 12V6a2 2 0 012-2h6" />
                {/* Top-right corner */}
                <path strokeLinecap="round" strokeWidth={2.5} d="M24 4h6a2 2 0 012 2v6" />
                {/* Bottom-left corner */}
                <path strokeLinecap="round" strokeWidth={2.5} d="M4 24v6a2 2 0 002 2h6" />
                {/* Bottom-right corner */}
                <path strokeLinecap="round" strokeWidth={2.5} d="M32 24v6a2 2 0 01-2 2h-6" />
              </svg>
              {/* Receipt icon in center */}
              <svg
                className="absolute inset-0 w-9 h-9 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 36 36"
                aria-hidden="true"
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
            <span className="font-bold text-xl text-gray-800">
              SnapReceipt
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                aria-current={isActive(link.path) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}

            {/* Auth Buttons */}
            <div className="ml-4 pl-4 border-l border-gray-200 flex items-center gap-2">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  Logout
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isActive('/login')
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden pb-4" role="navigation" aria-label="Mobile navigation">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                    isActive(link.path)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile Auth Buttons */}
              <div className="mt-2 pt-2 border-t border-gray-200">
                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 rounded-lg font-medium text-left text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                  >
                    Logout
                  </button>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                        isActive('/login')
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      Login
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 rounded-lg font-medium bg-blue-600 text-white text-center hover:bg-blue-700 transition-colors mt-1"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
