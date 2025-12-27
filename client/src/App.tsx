import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import ReceiptUpload from './components/ReceiptUpload';
import ReceiptGallery from './components/ReceiptGallery';
import ReceiptDetail from './components/ReceiptDetail';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import Login from './components/Login';
import Register from './components/Register';

// Home page with quick actions
const Home = () => (
  <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-gray-50 via-white to-blue-50 p-6 sm:p-10">
    <div className="max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-14">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5 tracking-tight">
          Costco Receipt Tracker
        </h1>
        <p className="text-gray-500 text-lg sm:text-xl max-w-2xl mx-auto">
          Upload and track your Costco spending
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {/* Upload Receipt Card - Featured/Large */}
        <a
          href="/upload"
          className="sm:col-span-2 lg:col-span-2 lg:row-span-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-8 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-6 group-hover:bg-white/30 transition-colors">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-bold text-2xl text-white mb-3">Upload Receipt</h3>
            <p className="text-blue-100 text-base leading-relaxed">Take a photo or upload an image of your Costco receipt to start tracking</p>
            <div className="mt-6 inline-flex items-center text-white font-medium">
              Get started
              <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>
        </a>

        {/* View Receipts Card */}
        <a
          href="/receipts"
          className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group border-l-4 border-emerald-500"
        >
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-xl text-gray-900 mb-2">View Receipts</h3>
              <p className="text-gray-500">Browse and search all your uploaded receipts</p>
            </div>
          </div>
        </a>

        {/* Analytics Card */}
        <a
          href="/dashboard"
          className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group border-l-4 border-purple-500"
        >
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-xl text-gray-900 mb-2">Analytics</h3>
              <p className="text-gray-500">View spending trends and category breakdowns</p>
            </div>
          </div>
        </a>
      </div>

      {/* Features Section */}
      <div className="mt-20 bg-white/70 backdrop-blur rounded-2xl shadow-lg p-8 border border-gray-100">
        <h2 className="font-bold text-2xl text-gray-900 mb-8 text-center">What you can do</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-gray-700 font-medium">Auto text extraction</span>
            <span className="text-gray-400 text-sm mt-1">From Costco receipts</span>
          </div>
          <div className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <span className="text-gray-700 font-medium">Item detection</span>
            <span className="text-gray-400 text-sm mt-1">Prices automatically parsed</span>
          </div>
          <div className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="text-gray-700 font-medium">Search & filter</span>
            <span className="text-gray-400 text-sm mt-1">Find any receipt fast</span>
          </div>
          <div className="flex flex-col items-center text-center p-4 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <span className="text-gray-700 font-medium">Spending insights</span>
            <span className="text-gray-400 text-sm mt-1">Charts and analytics</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/upload" element={<ReceiptUpload />} />
          <Route path="/dashboard" element={<AnalyticsDashboard />} />
          <Route path="/receipts" element={<ReceiptGallery />} />
          <Route path="/receipts/:id" element={<ReceiptDetail />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
