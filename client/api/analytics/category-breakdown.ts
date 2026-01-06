import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../lib/db';
import { verifyToken } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const result = await pool.query(`
      SELECT
        COALESCE(i.category, 'Uncategorized') as category,
        SUM(i.total_price) as total_spent,
        COUNT(*) as item_count
      FROM items i
      JOIN receipts r ON i.receipt_id = r.id
      WHERE r.user_id = $1
      GROUP BY COALESCE(i.category, 'Uncategorized')
      ORDER BY total_spent DESC
    `, [userId]);

    const categories = result.rows.map(row => ({
      category: row.category,
      totalSpent: parseFloat(row.total_spent) || 0,
      itemCount: parseInt(row.item_count) || 0,
    }));

    return res.json({ success: true, categories });
  } catch (error) {
    console.error('Category breakdown error:', error);
    return res.status(500).json({ error: 'Failed to fetch category breakdown' });
  }
}
