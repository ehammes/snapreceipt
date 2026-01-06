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
    const receiptResult = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) as total_spent, COUNT(*) as total_receipts
      FROM receipts WHERE user_id = $1 AND total_amount > 0
    `, [userId]);
    const receiptRow = receiptResult.rows[0];

    const totalSpent = parseFloat(receiptRow.total_spent) || 0;
    const totalReceipts = parseInt(receiptRow.total_receipts) || 0;
    const averagePerReceipt = totalReceipts > 0 ? totalSpent / totalReceipts : 0;

    const itemResult = await pool.query(`
      SELECT COALESCE(SUM(i.quantity), 0) as total_items, COUNT(DISTINCT LOWER(i.name)) as unique_items
      FROM items i JOIN receipts r ON i.receipt_id = r.id
      WHERE r.user_id = $1 AND r.total_amount > 0
    `, [userId]);
    const itemRow = itemResult.rows[0];

    return res.json({
      totalSpent,
      totalItems: parseInt(itemRow.total_items) || 0,
      uniqueItems: parseInt(itemRow.unique_items) || 0,
      totalReceipts,
      averagePerReceipt: Math.round(averagePerReceipt * 100) / 100,
    });
  } catch (error) {
    console.error('Summary metrics error:', error);
    return res.status(500).json({ error: 'Failed to fetch summary metrics' });
  }
}
