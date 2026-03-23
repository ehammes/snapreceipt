import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../lib/db';
import { verifyToken } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { receiptId } = req.query;

  if (!receiptId || typeof receiptId !== 'string') {
    return res.status(400).json({ error: 'receiptId query parameter is required' });
  }

  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'items array is required' });
  }

  try {
    // Verify receipt belongs to user
    const receiptCheck = await pool.query(
      'SELECT id FROM receipts WHERE id = $1 AND user_id = $2',
      [receiptId, userId]
    );
    if (receiptCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Update item_order for each item
    for (const item of items) {
      await pool.query(
        'UPDATE items SET item_order = $1 WHERE id = $2 AND receipt_id = $3',
        [item.item_order, item.id, receiptId]
      );
    }

    return res.json({ success: true, message: 'Items reordered' });
  } catch (error) {
    console.error('Reorder items error:', error);
    return res.status(500).json({ error: 'Failed to reorder items' });
  }
}
