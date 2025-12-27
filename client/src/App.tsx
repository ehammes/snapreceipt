import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import ReceiptUpload from './components/ReceiptUpload';
import ReceiptGallery from './components/ReceiptGallery';
import ReceiptDetail from './components/ReceiptDetail';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import Login from './components/Login';
import Register from './components/Register';

interface Receipt {
  id: string;
  store_name: string;
  purchase_date: string;
  total_amount: number;
  image_url?: string;
}

interface HomeStats {
  totalReceipts: number;
  totalSpent: number;
  monthlySpent: number;
  monthlyReceipts: number;
  recentReceipts: Receipt[];
}

// Home page with quick actions
const Home = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchSuccess, setFetchSuccess] = useState(false);

  // Check auth state and fetch stats
  const checkAuthAndFetchStats = () => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);

    if (token) {
      fetchStats(token);
    } else {
      setLoading(false);
      setStats(null);
      setFetchSuccess(false);
    }
  };

  useEffect(() => {
    checkAuthAndFetchStats();

    // Listen for storage changes (logout from another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        checkAuthAndFetchStats();
      }
    };

    // Listen for custom auth change event (logout from same tab)
    const handleAuthChange = () => {
      checkAuthAndFetchStats();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authChange', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authChange', handleAuthChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStats = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/receipts', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      console.log('Fetch response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('API response:', data);

        // Handle both array response and nested data response
        const receipts: Receipt[] = Array.isArray(data) ? data : (data.receipts || data.data || []);

        // Calculate stats
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyReceipts = receipts.filter(r => {
          const date = new Date(r.purchase_date);
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const totalSpent = receipts.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
        const monthlySpent = monthlyReceipts.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

        // Sort by date and get recent receipts
        const sortedReceipts = [...receipts].sort(
          (a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime()
        );

        const newStats = {
          totalReceipts: receipts.length,
          totalSpent,
          monthlySpent,
          monthlyReceipts: monthlyReceipts.length,
          recentReceipts: sortedReceipts.slice(0, 3),
        };
        console.log('Calculated stats:', newStats);
        setStats(newStats);
        setFetchSuccess(true);
      } else if (response.status === 401) {
        // Token is invalid, clear auth state
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const hasReceipts = stats && stats.totalReceipts > 0;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-slate-50 via-white to-blue-50 overflow-hidden">
      {/* Hero Section - ClickUp inspired */}
      <div className="relative px-6 pt-10 pb-6 sm:px-10 sm:pt-12 sm:pb-8">
        {/* Decorative floating elements */}
        <div className="absolute w-20 h-20 rounded-full top-20 left-10 bg-blue-400/20 blur-2xl animate-pulse" />
        <div className="absolute w-32 h-32 rounded-full top-40 right-16 bg-purple-400/20 blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute w-24 h-24 rounded-full bottom-10 left-1/4 bg-emerald-400/20 blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />

        {/* Floating receipt icons */}
        <div className="hidden lg:block absolute top-24 left-[15%] opacity-20">
          <svg className="w-12 h-12 text-blue-600 animate-bounce" style={{ animationDuration: '3s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="hidden lg:block absolute top-32 right-[12%] opacity-20">
          <svg className="w-10 h-10 text-purple-600 animate-bounce" style={{ animationDuration: '4s', animationDelay: '0.5s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div className="hidden lg:block absolute bottom-20 right-[20%] opacity-20">
          <svg className="w-8 h-8 text-emerald-600 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '1s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Logo Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative w-20 h-20 p-4 shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-blue-500/25">
              <svg
                className="w-full h-full text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 36 36"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9h12v18l-3-2-3 2-3-2-3 2V9z"
                />
                <path strokeLinecap="round" strokeWidth={2} d="M14 14h8M14 18h6" />
              </svg>
            </div>
          </div>

          <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text">Snap</span>
            <span className="text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">Receipt</span>
          </h1>

          <p className="max-w-2xl mx-auto mb-8 text-xl font-medium text-gray-600 sm:text-2xl">
            Smart receipt tracking, powered by AI
          </p>

          <p className="max-w-xl mx-auto mb-10 text-base text-gray-500">
            Snap a photo, extract data automatically, and gain insights into your spending patterns. No manual entry required.
          </p>

          {/* CTA Buttons - ClickUp style */}
          {!isLoggedIn && (
            <div className="flex flex-col items-center justify-center gap-4 mb-8 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-lg font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all hover:scale-[1.02]"
              >
                Get Started
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold text-gray-700 transition-all bg-white border border-gray-200 shadow-sm hover:bg-gray-50 rounded-xl hover:shadow-md"
              >
                Log in
              </Link>
            </div>
          )}

        </div>
      </div>

      <div className="px-6 pb-10 sm:px-10">
        <div className="max-w-5xl mx-auto">

        {/* Analytics Section - for logged-in users with receipts */}
        {isLoggedIn && !loading && stats && hasReceipts && (
          <div className="mb-6 space-y-4">
            {/* Quick Stats Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-md">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-sm font-medium text-white">{formatCurrency(stats.monthlySpent)} this month</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-gray-700">{formatCurrency(stats.totalSpent)} all time</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-gray-700">{stats.totalReceipts} receipts</span>
              </div>
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View Analytics
              </Link>
            </div>

            {/* Recent Activity */}
            {stats.recentReceipts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
                  <Link to="/receipts" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                    View all
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {stats.recentReceipts.map((receipt) => (
                    <Link
                      key={receipt.id}
                      to={`/receipts/${receipt.id}`}
                      className="p-4 transition-all bg-white border border-gray-100 shadow-sm rounded-xl hover:shadow-md hover:border-gray-200 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 transition-colors bg-gray-100 rounded-lg group-hover:bg-blue-50">
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{receipt.store_name || 'Receipt'}</p>
                          <p className="text-sm text-gray-500">{formatDate(receipt.purchase_date)}</p>
                        </div>
                        <p className="font-semibold text-gray-900">{formatCurrency(Number(receipt.total_amount))}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State Guidance - for new users or users with no receipts */}
        {isLoggedIn && !loading && fetchSuccess && !hasReceipts && (
          <div className="p-8 mb-8 text-center border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold text-gray-900">Welcome to SnapReceipt!</h3>
            <p className="max-w-md mx-auto mb-6 text-gray-600">
              You haven't uploaded any receipts yet. Start by taking a photo or uploading an image of your first receipt.
            </p>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-6 py-3 font-medium text-white transition-colors bg-blue-600 shadow-md hover:bg-blue-700 rounded-xl hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Your First Receipt
            </Link>
          </div>
        )}

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* Upload Receipt Card - Featured/Large */}
          <Link
            to="/upload"
            className="sm:col-span-2 lg:col-span-2 lg:row-span-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-8 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 -mt-16 -mr-16 rounded-full bg-white/10" />
            <div className="absolute bottom-0 left-0 w-24 h-24 -mb-12 -ml-12 rounded-full bg-white/10" />
            <div className="relative z-10">
              <div className="flex items-center justify-center w-16 h-16 mb-6 transition-colors bg-white/20 backdrop-blur rounded-xl group-hover:bg-white/30">
                <div className="relative w-10 h-10">
                  {/* Camera viewfinder corners */}
                  <svg className="absolute inset-0 w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 40 40">
                    <path strokeLinecap="round" strokeWidth={2.5} d="M4 12V6a2 2 0 012-2h6" />
                    <path strokeLinecap="round" strokeWidth={2.5} d="M28 4h6a2 2 0 012 2v6" />
                    <path strokeLinecap="round" strokeWidth={2.5} d="M4 28v6a2 2 0 002 2h6" />
                    <path strokeLinecap="round" strokeWidth={2.5} d="M36 28v6a2 2 0 01-2 2h-6" />
                  </svg>
                  {/* Receipt with upload arrow */}
                  <svg className="absolute inset-0 w-10 h-10 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 40 40">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10h14v20l-3.5-2.5-3.5 2.5-3.5-2.5-3.5 2.5V10z" />
                    <path strokeLinecap="round" strokeWidth={2} d="M20 23v-8m0 0l-3 3m3-3l3 3" />
                  </svg>
                </div>
              </div>
              <h3 className="mb-3 text-2xl font-bold text-white">Upload Receipt</h3>
              <p className="text-base leading-relaxed text-blue-100">Take a photo or upload an image of your receipt to start tracking</p>
              <div className="inline-flex items-center mt-6 font-medium text-white">
                Get started
                <svg className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* View Receipts Card */}
          <Link
            to="/receipts"
            className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group border-l-4 border-emerald-500"
          >
            <div className="flex items-start gap-5">
              <div className="flex items-center justify-center flex-shrink-0 transition-transform w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-xl group-hover:scale-110">
                <svg className="text-white w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">
                  View Receipts
                  {isLoggedIn && stats && hasReceipts && (
                    <span className="ml-2 text-sm font-normal text-gray-400">({stats.totalReceipts})</span>
                  )}
                </h3>
                <p className="text-gray-500">Browse and search all your uploaded receipts</p>
              </div>
            </div>
          </Link>

          {/* Analytics Card */}
          <Link
            to="/dashboard"
            className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group border-l-4 border-purple-500"
          >
            <div className="flex items-start gap-5">
              <div className="flex items-center justify-center flex-shrink-0 transition-transform w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-500 rounded-xl group-hover:scale-110">
                <svg className="text-white w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">
                  Analytics
                  {isLoggedIn && stats && hasReceipts && (
                    <span className="ml-2 text-sm font-normal text-gray-400">
                      {formatCurrency(stats.monthlySpent)} this month
                    </span>
                  )}
                </h3>
                <p className="text-gray-500">View spending trends and category breakdowns</p>
              </div>
            </div>
          </Link>
        </div>

        {/* How It Works Section */}
        <div className="p-8 mt-12 border border-gray-100 shadow-lg bg-white/70 backdrop-blur rounded-2xl">
          <h2 className="mb-8 text-2xl font-bold text-center text-gray-900">How it works</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="text-center">
              <div className="flex items-center justify-center mx-auto mb-4 bg-blue-100 rounded-full w-14 h-14">
                <span className="text-xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">Snap</h3>
              <p className="text-sm text-gray-500">Take a photo or upload an image of your receipt</p>
            </div>
            <div className="relative text-center">
              <div className="hidden sm:block absolute top-7 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-200 via-emerald-200 to-purple-200 -z-10" style={{ left: '-50%', right: '-50%' }}></div>
              <div className="relative z-10 flex items-center justify-center mx-auto mb-4 rounded-full w-14 h-14 bg-emerald-100">
                <span className="text-xl font-bold text-emerald-600">2</span>
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">Extract</h3>
              <p className="text-sm text-gray-500">AI automatically detects items, prices, and store info</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mx-auto mb-4 bg-purple-100 rounded-full w-14 h-14">
                <span className="text-xl font-bold text-purple-600">3</span>
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">Analyze</h3>
              <p className="text-sm text-gray-500">View spending trends and insights over time</p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

// Layout wrapper to conditionally show navigation and footer
const AppLayout = () => {
  const location = useLocation();
  const hideNavFooterRoutes = ['/register', '/login'];
  const showNavFooter = !hideNavFooterRoutes.includes(location.pathname);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {showNavFooter && <Navigation />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/upload" element={<ReceiptUpload />} />
          <Route path="/dashboard" element={<AnalyticsDashboard />} />
          <Route path="/receipts" element={<ReceiptGallery />} />
          <Route path="/receipts/:id" element={<ReceiptDetail />} />
        </Routes>
      </main>
      {showNavFooter && <Footer />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
