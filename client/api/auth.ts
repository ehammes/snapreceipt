import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Resend } from 'resend';
import pool from './lib/db';
import { generateToken } from './lib/auth';

const SALT_ROUNDS = 10;

const isValidEmail = (email: string): boolean => {
  return email.includes('@') && email.length > 3;
};

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'SnapReceipt <onboarding@resend.dev>';

const sendMagicLink = async (email: string, link: string): Promise<void> => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: 'Your SnapReceipt login link',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 800; color: #1e293b; margin: 0;">
            Snap<span style="color: #2563eb;">Receipt</span>
          </h1>
        </div>
        <h2 style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Log in to your account</h2>
        <p style="color: #64748b; margin-bottom: 32px; line-height: 1.6;">
          Click the button below to log in. This link expires in <strong>1 hour</strong> and can only be used once.
        </p>
        <a href="${link}" style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 600; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 10px; margin-bottom: 32px;">
          Log in to SnapReceipt
        </a>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          If you didn't request this, you can safely ignore this email.
          <br />This link will expire in 1 hour.
        </p>
      </div>
    `,
  });
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

    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
