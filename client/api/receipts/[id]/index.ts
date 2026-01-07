import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../lib/db';
import { verifyToken } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const receiptResult = await pool.query(
        'SELECT * FROM receipts WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (receiptResult.rows.length === 0) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      const itemsResult = await pool.query(
        'SELECT * FROM items WHERE receipt_id = $1 ORDER BY item_order, id',
        [id]
      );

      return res.json({
        success: true,
        receipt: { ...receiptResult.rows[0], items: itemsResult.rows },
      });
    }

    if (req.method === 'PATCH') {
      if (!req.body) {
        return res.status(400).json({ error: 'Request body is missing' });
      }
      const { storeName, storeLocation, storeCity, storeState, storeZip, purchaseDate, totalAmount } = req.body;

      // Verify ownership
      const checkResult = await pool.query(
        'SELECT id FROM receipts WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (storeName !== undefined) { updates.push(`store_name = $${paramIndex++}`); values.push(storeName); }
      if (storeLocation !== undefined) { updates.push(`store_location = $${paramIndex++}`); values.push(storeLocation); }
      if (storeCity !== undefined) { updates.push(`store_city = $${paramIndex++}`); values.push(storeCity); }
      if (storeState !== undefined) { updates.push(`store_state = $${paramIndex++}`); values.push(storeState); }
      if (storeZip !== undefined) { updates.push(`store_zip = $${paramIndex++}`); values.push(storeZip); }
      if (purchaseDate !== undefined) { updates.push(`purchase_date = $${paramIndex++}`); values.push(purchaseDate); }
      if (totalAmount !== undefined) { updates.push(`total_amount = $${paramIndex++}`); values.push(parseFloat(totalAmount)); }

      if (updates.length === 0) {
        return res.json({ success: true, message: 'No changes made' });
      }

      values.push(id, userId);
      const updateResult = await pool.query(
        `UPDATE receipts SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex} RETURNING *`,
        values
      );

      const itemsResult = await pool.query(
        'SELECT * FROM items WHERE receipt_id = $1 ORDER BY item_order, id',
        [id]
      );

      return res.json({
        success: true,
        receipt: { ...updateResult.rows[0], items: itemsResult.rows },
      });
    }

    if (req.method === 'DELETE') {
      const result = await pool.query(
        'DELETE FROM receipts WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Receipt not found' });
      }

      return res.json({ success: true, message: 'Receipt deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Receipt operation error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}
