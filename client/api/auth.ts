import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from './lib/db';
import { generateToken, verifyToken } from './lib/auth';
import { sendMagicLink, sendSpendingSummary } from './lib/emailService';

const SALT_ROUNDS = 10;

const isValidEmail = (email: string): boolean => {
  return email.includes('@') && email.length > 3;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // --- Magic link verification (GET) ---
  if (action === 'magic-link') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    try {
      const result = await pool.query(
        `SELECT * FROM magic_link_tokens WHERE token = $1 AND used = false`,
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Link is invalid or has expired' });
      }

      const magicToken = result.rows[0];

      // Check expiry in JS to avoid PostgreSQL timezone ambiguity
      if (new Date(magicToken.expires_at + 'Z') < new Date()) {
        return res.status(400).json({ error: 'Link is invalid or has expired' });
      }
      await pool.query(`UPDATE magic_link_tokens SET used = true WHERE id = $1`, [magicToken.id]);

      const jwt_token = generateToken(magicToken.user_id);
      return res.json({ token: jwt_token, userId: magicToken.user_id });
    } catch (error) {
      console.error('Magic link error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // --- Forgot password (POST) ---
    if (action === 'forgot-password') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const successResponse = { message: 'If that email is registered, a login link has been sent.' };

      const userResult = await pool.query('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase()]);
      if (userResult.rows.length === 0) return res.json(successResponse);

      const user = userResult.rows[0];
      const token = crypto.randomBytes(32).toString('hex');

      await pool.query(
        `INSERT INTO magic_link_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [user.id, token]
      );

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      await sendMagicLink(user.email, `${frontendUrl}/magic-link?token=${token}`);

      return res.json(successResponse);

    // --- Register (POST) ---
    } else if (action === 'register') {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
      if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

      const normalizedEmail = email.toLowerCase();
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
      if (existingUser.rows.length > 0) return res.status(409).json({ error: 'User with this email already exists' });

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [normalizedEmail, passwordHash]
      );

      return res.status(201).json({ token: generateToken(result.rows[0].id), userId: result.rows[0].id });

    // --- Login (POST) ---
    } else if (action === 'login') {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

      const normalizedEmail = email.toLowerCase();
      const result = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [normalizedEmail]);
      if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) return res.status(401).json({ error: 'Invalid credentials' });

      return res.json({ token: generateToken(user.id), userId: user.id });

    // --- Send spending summary email (POST) ---
    } else if (action === 'send-summary') {
      const userId = verifyToken(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      const email = userResult.rows[0].email;

      const metricsResult = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total_spent, COUNT(*) as receipt_count
         FROM receipts WHERE user_id = $1 AND total_amount > 0`,
        [userId]
      );
      const totalSpent = parseFloat(metricsResult.rows[0].total_spent) || 0;
      const receiptCount = parseInt(metricsResult.rows[0].receipt_count) || 0;

      const categoryResult = await pool.query(
        `SELECT COALESCE(i.category, 'Uncategorized') as category, SUM(i.total_price) as total_spent
         FROM items i JOIN receipts r ON i.receipt_id = r.id
         WHERE r.user_id = $1
         GROUP BY COALESCE(i.category, 'Uncategorized')
         ORDER BY total_spent DESC LIMIT 5`,
        [userId]
      );
      const categoryBreakdown = categoryResult.rows.map(row => ({
        category: row.category,
        totalSpent: parseFloat(row.total_spent) || 0,
      }));

      const itemsResult = await pool.query(
        `SELECT i.name, SUM(i.total_price) as total_spent, COUNT(DISTINCT r.id) as purchase_count
         FROM items i JOIN receipts r ON i.receipt_id = r.id
         WHERE r.user_id = $1
         GROUP BY i.name
         ORDER BY total_spent DESC LIMIT 3`,
        [userId]
      );
      const topItems = itemsResult.rows.map(row => ({
        name: row.name,
        totalSpent: parseFloat(row.total_spent) || 0,
        purchaseCount: parseInt(row.purchase_count) || 0,
      }));

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      await sendSpendingSummary(email, { totalSpent, receiptCount, categoryBreakdown, topItems, frontendUrl });

      return res.json({ success: true });

    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
