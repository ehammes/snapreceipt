import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Wrapper component for routing
const renderWithRouter = (component: React.ReactElement) => {
  return render(component);
};

describe('App', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('Home Page', () => {
    it('renders the main heading', () => {
      renderWithRouter(<App />);
      expect(screen.getByText('Costco Receipt Tracker')).toBeInTheDocument();
    });

    it('renders the subtitle', () => {
      renderWithRouter(<App />);
      expect(screen.getByText('Upload and track your Costco spending')).toBeInTheDocument();
    });

    it('renders the Upload Receipt card', () => {
      renderWithRouter(<App />);
      expect(screen.getByText('Upload Receipt')).toBeInTheDocument();
      expect(screen.getByText(/Take a photo or upload an image/i)).toBeInTheDocument();
    });

    it('renders the View Receipts card', () => {
      renderWithRouter(<App />);
      expect(screen.getByText('View Receipts')).toBeInTheDocument();
      expect(screen.getByText(/Browse and search all your uploaded receipts/i)).toBeInTheDocument();
    });

    it('renders the Analytics card', () => {
      renderWithRouter(<App />);
      // There are multiple 'Analytics' elements (nav + card), so check for the description
      expect(screen.getByText(/View spending trends and category breakdowns/i)).toBeInTheDocument();
    });

    it('renders the features section', () => {
      renderWithRouter(<App />);
      expect(screen.getByText('What you can do')).toBeInTheDocument();
      expect(screen.getByText('Auto text extraction')).toBeInTheDocument();
      expect(screen.getByText('Item detection')).toBeInTheDocument();
      expect(screen.getByText('Search & filter')).toBeInTheDocument();
      expect(screen.getByText('Spending insights')).toBeInTheDocument();
    });

    it('has correct links for quick action cards', () => {
      renderWithRouter(<App />);

      const uploadLink = screen.getByRole('link', { name: /upload receipt/i });
      expect(uploadLink).toHaveAttribute('href', '/upload');

      const receiptsLink = screen.getByRole('link', { name: /view receipts/i });
      expect(receiptsLink).toHaveAttribute('href', '/receipts');

      // Get the Analytics card link (not the nav link)
      const analyticsLinks = screen.getAllByRole('link', { name: /analytics/i });
      const analyticsCardLink = analyticsLinks.find(link => link.getAttribute('href') === '/dashboard');
      expect(analyticsCardLink).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('renders the navigation bar', () => {
      renderWithRouter(<App />);
      expect(screen.getByText('Costco Tracker')).toBeInTheDocument();
    });

    it('renders nav links', () => {
      renderWithRouter(<App />);
      expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^upload$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^receipts$/i })).toBeInTheDocument();
    });

    it('shows login and signup when not authenticated', () => {
      renderWithRouter(<App />);
      expect(screen.getAllByRole('link', { name: /login/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('link', { name: /sign up/i }).length).toBeGreaterThan(0);
    });

    it('shows logout button when authenticated', () => {
      localStorage.setItem('token', 'test-token');
      renderWithRouter(<App />);
      expect(screen.getAllByRole('button', { name: /logout/i }).length).toBeGreaterThan(0);
    });
  });
});
