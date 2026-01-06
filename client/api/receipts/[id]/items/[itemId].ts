import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../../../lib/db';
import { verifyToken } from '../../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = verifyToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id, itemId } = req.query;

  try {
    // Verify receipt ownership
    const receiptCheck = await pool.query(
      'SELECT id FROM receipts WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (receiptCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Verify item exists
    const itemCheck = await pool.query(
      'SELECT * FROM items WHERE id = $1 AND receipt_id = $2',
      [itemId, id]
    );
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (req.method === 'PUT') {
      const { name, unitPrice, quantity, category } = req.body;
      const existingItem = itemCheck.rows[0];

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) { updates.push(`name = $${paramIndex++}`); values.push(name); }
      if (unitPrice !== undefined) { updates.push(`unit_price = $${paramIndex++}`); values.push(parseFloat(unitPrice)); }
      if (quantity !== undefined) { updates.push(`quantity = $${paramIndex++}`); values.push(parseInt(quantity)); }
      if (category !== undefined) { updates.push(`category = $${paramIndex++}`); values.push(category || null); }

      // Calculate new total
      const newUnitPrice = unitPrice !== undefined ? parseFloat(unitPrice) : existingItem.unit_price;
      const newQuantity = quantity !== undefined ? parseInt(quantity) : existingItem.quantity;
      updates.push(`total_price = $${paramIndex++}`);
      values.push(newUnitPrice * newQuantity);

      values.push(itemId, id);
      const result = await pool.query(
        `UPDATE items SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND receipt_id = $${paramIndex} RETURNING *`,
        values
      );

      return res.json({ success: true, item: result.rows[0] });
    }

    if (req.method === 'DELETE') {
      await pool.query('DELETE FROM items WHERE id = $1 AND receipt_id = $2', [itemId, id]);
      return res.json({ success: true, message: 'Item deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Item operation error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}
