import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Placeholder pages - to be implemented
const Home = () => (
  <div className="min-h-screen bg-gray-100">
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">
        Costco Receipt Tracker
      </h1>
      <p className="text-gray-600">
        Upload and track your Costco receipts with automatic OCR processing.
      </p>
    </div>
  </div>
);

const Upload = () => (
  <div className="min-h-screen bg-gray-100">
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Upload Receipt</h1>
      <p className="text-gray-600">Upload your receipt image here.</p>
    </div>
  </div>
);

const Dashboard = () => (
  <div className="min-h-screen bg-gray-100">
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Dashboard</h1>
      <p className="text-gray-600">View your spending analytics.</p>
    </div>
  </div>
);

const Receipts = () => (
  <div className="min-h-screen bg-gray-100">
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Receipts</h1>
      <p className="text-gray-600">View all your receipts.</p>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/receipts" element={<Receipts />} />
      </Routes>
    </Router>
  );
}

export default App;
