import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Logo and tagline */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="relative w-8 h-8">
                <svg
                  className="absolute inset-0 w-8 h-8 text-blue-600"
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
                  className="absolute inset-0 w-8 h-8 text-blue-500"
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
              <span className="font-bold text-lg text-gray-800">SnapReceipt</span>
            </Link>
            <span className="hidden sm:inline text-gray-300">|</span>
            <span className="hidden sm:inline text-sm text-gray-500">Smart receipt tracking</span>
          </div>

          {/* Copyright */}
          <div className="text-sm text-gray-400">
            &copy; {currentYear} SnapReceipt
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
