import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from '../components/Login';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock fetch
global.fetch = jest.fn();

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Rendering', () => {
    it('renders the login form', () => {
      renderLogin();

      expect(screen.getByText('Log in to your account')).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });

    it('renders the signup link', () => {
      renderLogin();

      expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute(
        'href',
        '/register'
      );
    });
  });

  describe('Validation', () => {
    it('shows error when email is empty', async () => {
      renderLogin();

      const passwordInput = screen.getByLabelText(/password/i);
      await userEvent.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter your email')).toBeInTheDocument();
      });
    });

    it('shows error when password is empty', async () => {
      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      await userEvent.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter your password')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('submits the form with valid credentials', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test-token', userId: 'user-123' }),
      });

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth?action=login'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
          })
        );
      });
    });

    it('stores token and navigates on successful login', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'test-token', userId: 'user-123' }),
      });

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(localStorage.getItem('token')).toBe('test-token');
        expect(localStorage.getItem('userId')).toBe('user-123');
        expect(mockNavigate).toHaveBeenCalledWith('/receipts');
      });
    });

    it('shows error on invalid credentials', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'wrongpassword');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      });
    });

    it('shows error on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Connection failed. Please try again.')).toBeInTheDocument();
      });
    });

    it('shows loading state during submission', async () => {
      // Create a promise that we can control
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValueOnce(pendingPromise);

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/logging in/i)).toBeInTheDocument();
      });

      // Resolve the promise to clean up
      resolvePromise!({
        ok: true,
        json: async () => ({ token: 'test', userId: '1' }),
      });
    });

    it('disables button during loading', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValueOnce(pendingPromise);

      renderLogin();

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /log in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeDisabled();
      });

      // Resolve to clean up
      resolvePromise!({
        ok: true,
        json: async () => ({ token: 'test', userId: '1' }),
      });
    });
  });
});
