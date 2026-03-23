import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import UserModel from '../models/User';
import pool from '../config/database';
import { sendMagicLink } from '../services/emailService';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;

// Email validation helper
const isValidEmail = (email: string): boolean => {
  return email.includes('@') && email.length > 3;
};

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Validate password length
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email.toLowerCase());
    if (existingUser) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await UserModel.create(email.toLowerCase(), passwordHash);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' }
    );

    res.status(201).json({
      token,
      userId: user.id,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user by email
    const user = await UserModel.findByEmail(email.toLowerCase());
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' }
    );

    res.json({
      token,
      userId: user.id,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Always return success to avoid leaking whether an email is registered
    const successResponse = { message: 'If that email is registered, a login link has been sent.' };

    const user = await UserModel.findByEmail(email.toLowerCase());
    if (!user) {
      res.json(successResponse);
      return;
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Use PostgreSQL interval so expires_at and NOW() share the same timezone
    await pool.query(
      `INSERT INTO magic_link_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.id, token]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/magic-link?token=${token}`;

    await sendMagicLink(user.email, link);

    res.json(successResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/magic-link?token=xxx
router.get('/magic-link', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    // Look up the token — must be unused and not expired
    const result = await pool.query(
      `SELECT * FROM magic_link_tokens WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Link is invalid or has expired' });
      return;
    }

    const magicToken = result.rows[0];

    // Mark token as used
    await pool.query(`UPDATE magic_link_tokens SET used = true WHERE id = $1`, [magicToken.id]);

    // Issue JWT
    const jwt_token = jwt.sign(
      { userId: magicToken.user_id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' }
    );

    res.json({ token: jwt_token, userId: magicToken.user_id });
  } catch (error) {
    console.error('Magic link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
