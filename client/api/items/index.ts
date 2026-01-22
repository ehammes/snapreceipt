import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../lib/db';
import { verifyToken } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { receiptId } = req.query;
  const id = receiptId;

  try {
    const { name, unitPrice, quantity, discount, category, itemNumber } = req.body;

    if (!name || unitPrice === undefined || quantity === undefined) {
      return res.status(400).json({ error: 'Name, unitPrice, and quantity are required' });
    }

    // Verify receipt ownership
    const receiptCheck = await pool.query(
      'SELECT id FROM receipts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (receiptCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const discountValue = parseFloat(discount) || 0;
    const totalPrice = parseFloat(unitPrice) * parseInt(quantity) - discountValue;

    const result = await pool.query(
      `INSERT INTO items (receipt_id, name, unit_price, quantity, discount, total_price, category, item_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, name, parseFloat(unitPrice), parseInt(quantity), discountValue, totalPrice, category || null, itemNumber || null]
    );

    const itemsResult = await pool.query(
      'SELECT * FROM items WHERE receipt_id = $1 ORDER BY item_order, id',
      [id]
    );

    const receiptResult = await pool.query(
      'SELECT * FROM receipts WHERE id = $1',
      [id]
    );

    return res.status(201).json({
      success: true,
      item: result.rows[0],
      receipt: { ...receiptResult.rows[0], items: itemsResult.rows },
    });
  } catch (error) {
    console.error('Add item error:', error);
    return res.status(500).json({ error: 'Failed to add item' });
  }
}
