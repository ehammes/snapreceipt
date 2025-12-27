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
      // SnapReceipt appears in multiple places (nav and homepage)
      expect(screen.getAllByText('SnapReceipt').length).toBeGreaterThan(0);
    });

    it('renders the tagline', () => {
      renderWithRouter(<App />);
      expect(screen.getByText('Smart receipt tracking, powered by AI')).toBeInTheDocument();
    });

    it('renders the Upload Receipt card', () => {
      renderWithRouter(<App />);
      expect(screen.getByText('Upload Receipt')).toBeInTheDocument();
      // This text appears multiple times, so use getAllByText
      expect(screen.getAllByText(/Take a photo or upload an image/i).length).toBeGreaterThan(0);
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
      // Check the navigation is present with its aria-label
      expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    });

    it('renders nav links', () => {
      renderWithRouter(<App />);
      expect(screen.getByRole('link', { name: /^upload$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^receipts$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^analytics$/i })).toBeInTheDocument();
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
