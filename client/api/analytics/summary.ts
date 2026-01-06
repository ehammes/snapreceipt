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
        COUNT(DISTINCT r.id) as total_receipts,
        COALESCE(SUM(r.total_amount), 0) as total_spent,
        COUNT(DISTINCT i.name) as unique_items,
        COALESCE(AVG(r.total_amount), 0) as avg_receipt,
        MIN(r.purchase_date) as first_purchase,
        MAX(r.purchase_date) as last_purchase
      FROM receipts r
      LEFT JOIN items i ON r.id = i.receipt_id
      WHERE r.user_id = $1
    `, [userId]);
    const row = result.rows[0];

    return res.json({
      success: true,
      summary: {
        totalReceipts: parseInt(row.total_receipts) || 0,
        totalSpent: parseFloat(row.total_spent) || 0,
        uniqueItems: parseInt(row.unique_items) || 0,
        avgReceipt: parseFloat(row.avg_receipt) || 0,
        firstPurchase: row.first_purchase,
        lastPurchase: row.last_purchase,
      },
    });
  } catch (error) {
    console.error('Summary error:', error);
    return res.status(500).json({ error: 'Failed to fetch summary' });
  }
}
